import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"
import * as generator from "./dart-generator"

let panel: vscode.WebviewPanel | undefined = undefined

export function activate(context: vscode.ExtensionContext) {
  console.log("Dart Bean Generator extension is now active")

  const disposable = vscode.commands.registerCommand("dart-bean-generator.generate", () => {
    // Check if a workspace is open
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("Please open a project folder first")
      return
    }

    panel = vscode.window.createWebviewPanel("dartBeanGenerator", "Make Dart bean Class Code", vscode.ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
    })

    // Get the workspace root path
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath
    const config = vscode.workspace.getConfiguration('dart-bean-generator')
    const jsonDirRelative = config.get<string>('jsonDirPath', path.join('lib', 'generated', 'json'))
    const jsonDirPath = path.join(workspaceRoot, jsonDirRelative)
    const entityPath = path.join(workspaceRoot, 'lib', 'entity')

    // Send the workspace paths to the webview
    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri, entityPath, jsonDirPath)

    panel.webview.onDidReceiveMessage(
      async (message: any) => {
        try {
          switch (message.command) {
            case "generate":
              await generateDartClass(message.className, message.jsonText, message.options)
              // Notify webview of successful generation
              if (panel) {
                panel.webview.postMessage({ command: "generationComplete", success: true })
              }
              return
            case "format":
              if (panel) {
                formatJson(panel.webview, message.jsonText)
              }
              return
            case "cancel":
              if (panel) {
                panel.dispose()
              }
              return
          }
        } catch (error) {
          // Send error back to webview
          if (panel) {
            panel.webview.postMessage({
              command: "error",
              message: `Operation failed: ${(error as Error).message}`,
            })
          }
          vscode.window.showErrorMessage(`Operation failed: ${(error as Error).message}`)
        }
      },
      undefined,
      context.subscriptions,
    )
  })

  context.subscriptions.push(disposable)
}

/**
 * Generate Dart class from JSON
 */
async function generateDartClass(className: string, jsonText: string, options: any): Promise<void> {
  // Notify webview that generation has started
  if (panel && panel.webview) {
    panel.webview.postMessage({ command: "generationStarted" })
  }

  if (!className) {
    vscode.window.showErrorMessage("Class name is required")
    return
  }

  try {
    // Validate JSON format
    JSON.parse(jsonText)

    // Dynamically determine the project root directory
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      throw new Error("No workspace open")
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath
    const libDirPath = path.join(workspaceRoot, "lib")
    const config = vscode.workspace.getConfiguration('dart-bean-generator')
    const jsonDirRelative = config.get<string>('jsonDirPath', path.join('lib', 'generated', 'json'))
    const jsonDirPath = path.join(workspaceRoot, jsonDirRelative)

    // Get package name from pubspec.yaml if possible
    let packageName = "app"
    try {
      const pubspecPath = path.join(workspaceRoot, "pubspec.yaml")
      if (fs.existsSync(pubspecPath)) {
        const pubspecContent = fs.readFileSync(pubspecPath, "utf8")
        const nameMatch = pubspecContent.match(/name:\s*([^\s]+)/)
        if (nameMatch && nameMatch[1]) {
          packageName = nameMatch[1].trim()
        }
      }
    } catch (e) {
      console.warn("Could not determine package name from pubspec.yaml:", e)
    }

    // Ensure lib directory exists
    if (!fs.existsSync(libDirPath)) {
      await fs.promises.mkdir(libDirPath, { recursive: true })
    }

    // Create entity directory if it doesn't exist
    const entityDirPath = path.join(libDirPath, "entity")
    if (!fs.existsSync(entityDirPath)) {
      await fs.promises.mkdir(entityDirPath, { recursive: true })
    }

    // Ensure json directory exists
    if (!fs.existsSync(jsonDirPath)) {
      await fs.promises.mkdir(jsonDirPath, { recursive: true })
    }

    // Check if base directory exists inside json, if not create it
    const baseDirPath = path.join(jsonDirPath, "base")
    if (!fs.existsSync(baseDirPath)) {
      await fs.promises.mkdir(baseDirPath, { recursive: true })
    }

    // Create json_convert_content.dart if it doesn't exist
    const jsonConvertPath = path.join(baseDirPath, "json_convert_content.dart");

/**
 * 批量更新 json_convert_content.dart，把 allClassNames 里的所有类
 * 都插入到 import 和 convertFuncMap 里（含 listHandler）。
 *
 * @param allClassNames  所有生成的类名，如 ["Test2", "Test2Address", "Test2Links"]
 * @param packageName    从 pubspec.yaml 解析到的包名，如 "my_app"
 */
async function updateJsonConvertContent(allClassNames: string[], packageName: string, jsonDirRelative: string): Promise<void> {
	// 1) 无工作区则抛出异常
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
	  throw new Error("No workspace open")
	}
  
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath
        const baseDirPath = path.join(workspaceRoot, jsonDirRelative, "base")
	const jsonConvertPath = path.join(baseDirPath, "json_convert_content.dart")
  
	// 2) 如果 json_convert_content.dart 不存在，先创建一个基础模板
	if (!fs.existsSync(jsonConvertPath)) {
	  const baseContent = `
  // ignore_for_file: non_constant_identifier_names
  // ignore_for_file: camel_case_types
  // ignore_for_file: prefer_single_quotes
  
  // This file is automatically generated. DO NOT EDIT, all your changes would be lost.
  import 'package:flutter/material.dart' show debugPrint;
  
  JsonConvert jsonConvert = JsonConvert();
  
  typedef JsonConvertFunction<T> = T Function(Map<String, dynamic> json);
  typedef EnumConvertFunction<T> = T Function(String value);
  typedef ConvertExceptionHandler = void Function(Object error, StackTrace stackTrace);
  
  extension MapSafeExt<K, V> on Map<K, V> {
	T? getOrNull<T>(K? key) {
	  if (!containsKey(key) || key == null) {
		return null;
	  } else {
		return this[key] as T?;
	  }
	}
  }
  
  class JsonConvert {
	static ConvertExceptionHandler? onError;
	JsonConvertClassCollection convertFuncMap = JsonConvertClassCollection();
  
	void reassembleConvertFuncMap() {
	  bool isReleaseMode = const bool.fromEnvironment('dart.vm.product');
	  if (!isReleaseMode) {
		convertFuncMap = JsonConvertClassCollection();
	  }
	}
  
	T? convert<T>(dynamic value, {EnumConvertFunction? enumConvert}) {
	  if (value == null) {
		return null;
	  }
	  if (value is T) {
		return value;
	  }
	  try {
		return _asT<T>(value, enumConvert: enumConvert);
	  } catch (e, stackTrace) {
		debugPrint('asT<$T> $e $stackTrace');
		if (onError != null) {
		  onError!(e, stackTrace);
		}
		return null;
	  }
	}
  
	List<T?>? convertList<T>(List<dynamic>? value,
		{EnumConvertFunction? enumConvert}) {
	  if (value == null) {
		return null;
	  }
	  try {
		return value.map((dynamic e) => _asT<T>(e, enumConvert: enumConvert))
			.toList();
	  } catch (e, stackTrace) {
		debugPrint('asT<$T> $e $stackTrace');
		if (onError != null) {
		  onError!(e, stackTrace);
		}
		return <T>[];
	  }
	}
  
	List<T>? convertListNotNull<T>(dynamic value,
		{EnumConvertFunction? enumConvert}) {
	  if (value == null) {
		return null;
	  }
	  try {
		return (value as List<dynamic>).map((dynamic e) =>
		_asT<T>(e, enumConvert: enumConvert)!).toList();
	  } catch (e, stackTrace) {
		debugPrint('asT<$T> $e $stackTrace');
		if (onError != null) {
		  onError!(e, stackTrace);
		}
		return <T>[];
	  }
	}
  
	T? _asT<T extends Object?>(dynamic value, {EnumConvertFunction? enumConvert}) {
	  final String type = T.toString();
	  final String valueS = value.toString();
	  if (enumConvert != null) {
		return enumConvert(valueS) as T;
	  } else if (type == "String") {
		return valueS as T;
	  } else if (type == "int") {
		final int? intValue = int.tryParse(valueS);
		if (intValue == null) {
		  return double.tryParse(valueS)?.toInt() as T?;
		} else {
		  return intValue as T;
		}
	  } else if (type == "double") {
		return double.parse(valueS) as T;
	  } else if (type == "DateTime") {
		return DateTime.parse(valueS) as T;
	  } else if (type == "bool") {
		if (valueS == '0' || valueS == '1') {
		  return (valueS == '1') as T;
		}
		return (valueS == 'true') as T;
	  } else if (type == "Map" || type.startsWith("Map<")) {
		return value as T;
	  } else {
		if (convertFuncMap.containsKey(type)) {
		  if (value == null) {
			return null;
		  }
		  var covertFunc = convertFuncMap[type]!;
		  return covertFunc(Map<String, dynamic>.from(value as Map)) as T;
		} else {
		  throw UnimplementedError(
			  '\$type unimplemented,you can try running the app again');
		}
	  }
	}
  
	//list is returned by type
	static M? _getListChildType<M>(List<Map<String, dynamic>> data) {
	  // *** GENERATED LIST TYPE HANDLING ***
	  return null;
	}
  
	static M? fromJsonAsT<M>(dynamic json) {
	  if (json is M) {
		return json;
	  }
	  if (json is List) {
		return _getListChildType<M>(
			json.map((dynamic e) => e as Map<String, dynamic>).toList());
	  } else {
		return jsonConvert.convert<M>(json);
	  }
	}
  }
  
  class JsonConvertClassCollection {
	Map<String, JsonConvertFunction> convertFuncMap = {
	  // *** GENERATED CONVERSION MAP ***
	};
  
	bool containsKey(String type) {
	  return convertFuncMap.containsKey(type);
	}
  
	JsonConvertFunction? operator [](String key) {
	  return convertFuncMap[key];
	}
  }
  `;
	  fs.mkdirSync(baseDirPath, { recursive: true })
	  fs.writeFileSync(jsonConvertPath, baseContent, "utf-8")
	}
  
	// 3) 读取已存在的 json_convert_content.dart
	let content = fs.readFileSync(jsonConvertPath, "utf-8")
	const lines = content.split("\n")
  
	// 4) 找到最后一个 import 的位置，以便插入新的 import
	let lastImportIndex = -1
	for (let i = 0; i < lines.length; i++) {
	  if (lines[i].trim().startsWith("import ")) {
		lastImportIndex = i
	  }
	}
	let lastImportEndIndex = lastImportIndex >= 0 ? lastImportIndex + 1 : 0
  
	// 5) 循环所有类名，插入 import 语句（如果你的结构是“所有类在一个 .dart 文件”，只需插一次）
	//    这里假设每个类都有自己独立的 dart 文件，如 "Test2Address" -> "test2address.dart"
	for (const cls of allClassNames) {
	  const fileName = cls.toLowerCase()     // 转小写得到文件名
	  const entityImport = `import 'package:${packageName}/entity/${fileName}.dart';`
  
	  // 如果不存在，则插入
	  if (!content.includes(entityImport)) {
		lines.splice(lastImportEndIndex, 0, entityImport)
		lastImportEndIndex++
	  }
	}
  
	// 拼回字符串
	content = lines.join("\n")
  
	// 6) 更新 _getListChildType<M>，让所有 List<> 的子类能被处理
	//    你之前提到有个 listHandlerRegex，类似：
	const listHandlerRegex = /static M\?\s+_getListChildType<M>\(List<Map<String,\s?dynamic>>\s+data\)\s+\{([\s\S]*?)return null;([\s\S]*?)\}/m
	const matchListHandler = listHandlerRegex.exec(content)
  
	if (matchListHandler) {
	  // 我们收集所有类名中那些可能会出现作为 List<Class> 的情况
	  // 因为我们不知道哪个一定是 list，但可以统一插入
	  // 例子中直接在 if (<Test2Address>[] is M) {...} 一样的写法。
	  let newBody = ""
	  for (const cls of allClassNames) {
		newBody += `    if (<${cls}>[] is M) {\n`
		newBody += `      return data.map<${cls}>((Map<String, dynamic> e) => ${cls}.fromJson(e)).toList() as M;\n`
		newBody += `    }\n\n`
	  }
  
	  newBody += `    debugPrint("\$M not found");\n`
	  newBody += `    return null;`
  
	  const newListHandler = `static M? _getListChildType<M>(List<Map<String, dynamic>> data) {\n${newBody}\n  }`
	  content = content.replace(listHandlerRegex, newListHandler)
	}
  
	// 7) 更新 convertFuncMap
	//    你之前提到的 mapRegex:
	const mapRegex = /Map<String,\s?JsonConvertFunction>\s+convertFuncMap\s*=\s*\{([\s\S]*?)\};/
	const matchMap = mapRegex.exec(content)
	if (matchMap) {
	  let existingMapBody = matchMap[1]
  
	  // 给每个类插入一行
	  for (const cls of allClassNames) {
		const mapLine = `    (${cls}).toString(): ${cls}.fromJson,`
		if (!existingMapBody.includes(mapLine)) {
		  existingMapBody += `\n${mapLine}`
		}
	  }
  
	  const newMapBlock = `Map<String, JsonConvertFunction> convertFuncMap = {${existingMapBody}\n};`
	  content = content.replace(mapRegex, newMapBlock)
	}
  
	// 8) 写回文件
	fs.writeFileSync(jsonConvertPath, content, "utf-8")
  }

    // Generate Dart code with the correct import path
    const generateResult = generator.DartGenerator.generateClass(className, jsonText, {
      nullable: options.nullable,
      defaultValue: options.defaultValue,
      equatable: options.equatable,
    })
    const dartCode = generateResult.code
    const allClassNames = generateResult.allClassNames

    // Generate .g file content
    const gFileContent = generator.DartGenerator.generateGFile(className, jsonText, packageName, {
      nullable: options.nullable,
      defaultValue: options.defaultValue,
      equatable: options.equatable,
    })

    await updateJsonConvertContent(allClassNames, packageName, jsonDirRelative)

    // Create the main Dart file in the entity directory
    const fileName = `${className.toLowerCase()}.dart`
    const fileUri = vscode.Uri.file(path.join(entityDirPath, fileName))

    // Create the .g file in the generated/json directory
    const gFileName = `${className.toLowerCase()}.g.dart`
    const gFileUri = vscode.Uri.file(path.join(jsonDirPath, gFileName))

    // Write the .g file
    await vscode.workspace.fs.writeFile(gFileUri, Buffer.from(gFileContent, "utf-8"))
    vscode.window.showInformationMessage(`Generated: ${gFileUri.fsPath}`)

    // Write the main Dart file
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(dartCode, "utf-8"))
    vscode.window.showInformationMessage(`Successfully generated: ${fileUri.fsPath}`)

    // Automatically open the generated file
    const doc = await vscode.workspace.openTextDocument(fileUri)
    vscode.window.showTextDocument(doc)
  } catch (e) {
    vscode.window.showErrorMessage(`Generation failed: ${(e as Error).message}`)
  }
}

/**
 * Format JSON text
 */
function formatJson(webview: vscode.Webview, jsonText: string): void {
  try {
    const parsedJson = JSON.parse(jsonText)
    const formattedJson = JSON.stringify(parsedJson, null, 2)
    webview.postMessage({
      command: "jsonFormatted",
      json: formattedJson,
    })
  } catch (e) {
    vscode.window.showErrorMessage(`Invalid JSON: ${(e as Error).message}`)
  }
}

/**
 * Get the HTML content for the webview
 */
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, entityPath: string, jsonDirPath: string): string {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Make Dart bean Class Code</title>
    <style>
      :root {
        --vscode-foreground: var(--vscode-editor-foreground);
        --vscode-background: var(--vscode-editor-background);
        --vscode-border-color: #e0e0e0;
        --vscode-input-border: #ccc;
        --vscode-button-background: #1976d2;
        --vscode-button-foreground: white;
        --vscode-button-hover-background: #1565c0;
        --vscode-checkbox-background: white;
        --vscode-checkbox-border: #ccc;
        --vscode-checkbox-checked-background: #1976d2;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        padding: 0;
        margin: 0;
        background-color: white;
        color: black;
      }
      
      .container {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 15px;
        border-bottom: 1px solid var(--vscode-border-color);
        background-color: white;
      }
      
      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .header-icon {
        color: #1976d2;
      }
      
      .content {
        padding: 15px;
        flex: 1;
        overflow: auto;
        background-color: white;
      }
      
      .form-group {
        margin-bottom: 15px;
      }
      
      label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        color: black;
      }
      
      input[type="text"], textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        box-sizing: border-box;
        background-color: white;
        color: black;
      }
      
      input[type="text"]:focus, textarea:focus {
        outline: none;
        border-color: #1976d2;
        box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
      }
      
      textarea {
        min-height: 200px;
        resize: vertical;
      }
      
      .path-info {
        margin-bottom: 15px;
        padding: 8px;
        background-color: #f5f5f5;
        border-radius: 4px;
        font-size: 14px;
        color: #555;
      }
      
      .checkbox-group {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .options-row {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 15px;
      }
      
      .format-btn {
        margin-left: auto;
      }
      
      .footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 10px 15px;
        border-top: 1px solid var(--vscode-border-color);
        background-color: white;
      }
      
      button {
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .btn-primary {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 6px 20px;
      }
      
      .btn-primary:hover {
        background-color: var(--vscode-button-hover-background);
      }
      
      .btn-secondary {
        background-color: white;
        color: #333;
        border: 1px solid #ccc;
      }
      
      .btn-secondary:hover {
        background-color: #f5f5f5;
      }
      
      .close-btn {
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: #666;
      }
      
      .close-btn:hover {
        color: #333;
      }
      
      input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: #1976d2;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="header-title">
          <div class="header-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3L2 12h3v8h14v-8h3L12 3z" />
            </svg>
          </div>
          <h2 style="margin: 0; font-size: 16px;">Make Dart bean Class Code</h2>
        </div>
        <button class="close-btn" id="closeBtn">✕</button>
      </div>
      
      <div class="content">
        <div class="form-group">
          <label for="className">Class Name:</label>
          <input type="text" id="className" name="className">
        </div>
        
        <div class="form-group">
          <label for="jsonText">JSON Text:</label>
          <textarea id="jsonText" name="jsonText"></textarea>
        </div>
        
        <div class="path-info">
          Entity classes: <strong>${entityPath}</strong>
          <br>
          Generated files: <strong>${jsonDirPath}</strong>
        </div>
        
        <div class="options-row">
          <div class="checkbox-group">
            <input type="checkbox" id="nullable" name="nullable" checked>
            <label for="nullable" style="display: inline;">null-able</label>
          </div>
          
          <div class="checkbox-group">
            <input type="checkbox" id="defaultValue" name="defaultValue">
            <label for="defaultValue" style="display: inline;">default value</label>
          </div>
          
          <div class="checkbox-group">
            <input type="checkbox" id="equatable" name="equatable" checked>
            <label for="equatable" style="display: inline;">Equatable</label>
          </div>
          
          <button class="btn-secondary format-btn" id="formatBtn">Format</button>
        </div>
      </div>
      
      <div class="footer">
        <button class="btn-primary" id="makeBtn">Make</button>
        <button class="btn-secondary" id="cancelBtn">Cancel</button>
      </div>
    </div>

    <script>
      (function() {
        const vscode = acquireVsCodeApi();
        
        // Elements
        const classNameInput = document.getElementById('className');
        const jsonTextArea = document.getElementById('jsonText');
        const nullableCheckbox = document.getElementById('nullable');
        const defaultValueCheckbox = document.getElementById('defaultValue');
        const equatableCheckbox = document.getElementById('equatable');
        const formatBtn = document.getElementById('formatBtn');
        const makeBtn = document.getElementById('makeBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const closeBtn = document.getElementById('closeBtn');
        
        // Event listeners
        formatBtn.addEventListener('click', () => {
          vscode.postMessage({
            command: 'format',
            jsonText: jsonTextArea.value
          });
        });
        
        makeBtn.addEventListener('click', () => {
          vscode.postMessage({
            command: 'generate',
            className: classNameInput.value,
            jsonText: jsonTextArea.value,
            options: {
              nullable: nullableCheckbox.checked,
              defaultValue: defaultValueCheckbox.checked,
              equatable: equatableCheckbox.checked
            }
          });
        });
        
        cancelBtn.addEventListener('click', () => {
          vscode.postMessage({
            command: 'cancel'
          });
        });
        
        closeBtn.addEventListener('click', () => {
          vscode.postMessage({
            command: 'cancel'
          });
        });
        
        // Handle additional messages from the extension
        window.addEventListener('message', event => {
          const message = event.data;
          
          switch (message.command) {
            case 'jsonFormatted':
              jsonTextArea.value = message.json;
              break;
            case 'generationStarted':
              // Disable buttons during generation
              makeBtn.disabled = true;
              makeBtn.textContent = 'Processing...';
              break;
            case 'generationComplete':
              // Re-enable buttons after generation
              makeBtn.disabled = false;
              makeBtn.textContent = 'Make';
              break;
            case 'error':
              // Re-enable buttons and show error
              makeBtn.disabled = false;
              makeBtn.textContent = 'Make';
              // You could display the error in the UI if needed
              break;
          }
        });
      }());
    </script>
  </body>
  </html>`
}

export function deactivate() {}

