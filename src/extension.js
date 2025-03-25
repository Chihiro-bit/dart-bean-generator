"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
function activate(context) {
    console.log("Dart Bean Generator extension is now active");
    // Register the command to generate Dart bean class
    const disposable = vscode.commands.registerCommand("dart-bean-generator.generate", () => {
        // Create and show panel
        const panel = vscode.window.createWebviewPanel("dartBeanGenerator", "Make Dart bean Class Code", vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
        });
        // Set the webview's HTML content
        panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case "generate":
                    generateDartClass(message.className, message.jsonText, message.options);
                    return;
                case "choosePath":
                    choosePath(panel.webview);
                    return;
                case "format":
                    formatJson(panel.webview, message.jsonText);
                    return;
                case "cancel":
                    panel.dispose();
                    return;
            }
        }, undefined, context.subscriptions);
    });
    context.subscriptions.push(disposable);
}
/**
 * Generate Dart class from JSON
 */
function generateDartClass(className, jsonText, options) {
    if (!className) {
        vscode.window.showErrorMessage("Class name is required");
        return;
    }
    try {
        // Parse JSON to validate
        JSON.parse(jsonText);
        // In a real implementation, you would:
        // 1. Generate the Dart class based on the JSON and options
        // 2. Create or update the file at the specified path
        if (options.specificPath) {
            const filePath = path.join(options.path, `${className.toLowerCase()}.dart`);
            vscode.window.showInformationMessage(`Generated Dart class at: ${filePath}`);
        }
        else {
            // If no specific path, we could create in the current editor's directory
            // or ask the user where to save
            vscode.window.showInformationMessage(`Generated Dart class: ${className}`);
        }
    }
    catch (e) {
        vscode.window.showErrorMessage(`Invalid JSON: ${e.message}`);
    }
}
/**
 * Open dialog to choose path
 */
function choosePath(webview) {
    vscode.window
        .showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Folder",
    })
        .then((fileUri) => {
        if (fileUri && fileUri.length > 0) {
            webview.postMessage({
                command: "pathSelected",
                path: fileUri[0].fsPath,
            });
        }
    });
}
/**
 * Format JSON text
 */
function formatJson(webview, jsonText) {
    try {
        const parsedJson = JSON.parse(jsonText);
        const formattedJson = JSON.stringify(parsedJson, null, 2);
        webview.postMessage({
            command: "jsonFormatted",
            json: formattedJson,
        });
    }
    catch (e) {
        vscode.window.showErrorMessage(`Invalid JSON: ${e.message}`);
    }
}
/**
 * Get the HTML content for the webview
 */
function getWebviewContent(webview, extensionUri) {
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
      
      .path-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
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
        
        <div class="path-row">
          <div class="checkbox-group">
            <input type="checkbox" id="specificPath" name="specificPath" checked>
            <label for="specificPath" style="display: inline;">Only generate code in a specific path</label>
          </div>
          <input type="text" id="path" name="path" value="E:/Word/FlutterProject/hiddify-app/lib/entity" style="flex: 1;">
          <button class="btn-secondary" id="choosePathBtn">Choose Path</button>
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
        const specificPathCheckbox = document.getElementById('specificPath');
        const pathInput = document.getElementById('path');
        const choosePathBtn = document.getElementById('choosePathBtn');
        const nullableCheckbox = document.getElementById('nullable');
        const defaultValueCheckbox = document.getElementById('defaultValue');
        const equatableCheckbox = document.getElementById('equatable');
        const formatBtn = document.getElementById('formatBtn');
        const makeBtn = document.getElementById('makeBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const closeBtn = document.getElementById('closeBtn');
        
        // Update path input state based on checkbox
        function updatePathInputState() {
          pathInput.disabled = !specificPathCheckbox.checked;
          choosePathBtn.disabled = !specificPathCheckbox.checked;
        }
        
        // Initialize
        updatePathInputState();
        
        // Event listeners
        specificPathCheckbox.addEventListener('change', updatePathInputState);
        
        choosePathBtn.addEventListener('click', () => {
          vscode.postMessage({
            command: 'choosePath'
          });
        });
        
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
              specificPath: specificPathCheckbox.checked,
              path: pathInput.value,
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
        
        // Handle messages from the extension
        window.addEventListener('message', event => {
          const message = event.data;
          
          switch (message.command) {
            case 'pathSelected':
              pathInput.value = message.path;
              break;
            case 'jsonFormatted':
              jsonTextArea.value = message.json;
              break;
          }
        });
      }());
    </script>
  </body>
  </html>`;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map