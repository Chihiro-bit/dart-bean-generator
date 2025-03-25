/**
 * 我们定义一个返回结果的接口，包含最终源码 + 类名数组
 */
export interface GenerateResult {
  code: string;              // 完整的 Dart 类源码(主类 + 所有子类)
  allClassNames: string[];   // 收集到的所有类名(如 ["Test2", "Test2Address", "Test2Links"])
}

/**
 * Utility class for generating Dart bean classes from JSON
 */
export class DartGenerator {
  /**
   * Generate a Dart class from JSON
   * @param className 主类名，如 "Test2"
   * @param jsonText  原始 JSON 字符串
   * @param options   额外选项，比如 { nullable: boolean, defaultValue: boolean, equatable: boolean }
   * @returns { code, allClassNames }
   */
  public static generateClass(
    className: string,
    jsonText: string,
    options: {
      nullable: boolean;
      defaultValue: boolean;
      equatable: boolean;
    },
  ): GenerateResult {
    try {
      // 1) 解析 JSON
      const jsonObj = JSON.parse(jsonText);

      // 2) 用于收集所有生成的类名(包括主类 + 嵌套类)
      const generatedClasses = new Set<string>();

      // 3) 先生成所有嵌套类
      //    deepGenerateClasses 会返回子类的源码，并把类名插入 generatedClasses
      const nestedClassesCode = this.deepGenerateClasses(jsonObj, className, generatedClasses, options);

      // 4) 生成主类的源码
      //    buildMainClass 只是生成当前类的字符串，不会往 generatedClasses 里加 className
      //    所以我们手动插入一下
      generatedClasses.add(className);
      const mainClassCode = this.buildMainClass(className, jsonObj, options, generatedClasses);

      // 5) 拼接最终文件内容(带 import)
      //    allClassesCode = 嵌套类 + 主类源码
      const allClassesCode = [
        ...nestedClassesCode,
        mainClassCode,
      ];

      // 6) 如果你需要自动引入 json_annotation/ equatable 等，可在这里写
      const finalCode = [
        "import 'package:json_annotation/json_annotation.dart';",
        options.equatable ? "import 'package:equatable/equatable.dart';" : "",
        "",
        ...allClassesCode,
      ].join("\n");

      // 7) 返回 { code, allClassNames }
      return {
        code: finalCode,
        allClassNames: Array.from(generatedClasses),  // 将集合转成数组
      };
    } catch (e) {
      throw new Error(`Failed to generate Dart class: ${(e as Error).message}`);
    }
  }

  /**
   * Generate the .g.dart file content (可保持你原先逻辑)
   */
  public static generateGFile(
    className: string,
    jsonText: string,
    packageName = "app",
    options: {
      nullable: boolean;
      defaultValue: boolean;
      equatable: boolean;
    },
  ): string {
    // ...这里不做重点修改，维持你以前的写法即可
    try {
      const jsonObj = JSON.parse(jsonText);
      // ...剩余逻辑省略
      return "YOUR_G_FILE_CODE_HERE";
    } catch (e) {
      throw new Error(`Failed to generate .g file: ${(e as Error).message}`);
    }
  }

  /**
   * 递归生成所有嵌套类
   * @param obj 当前 JSON 对象(可能是普通对象或数组)
   * @param parentClassName 父类名，用于拼接新的子类名
   * @param generatedClasses 用于收集所有生成的类名(避免重复)
   * @param options
   * @param depth 深度(可选)
   * @returns string[] 返回生成的类源码数组
   */
  private static deepGenerateClasses(
    obj: any,
    parentClassName: string,
    generatedClasses: Set<string>,
    options: any,
    depth = 0,
  ): string[] {
    let classes: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      // 如果是 object => 生成新的子类
      if (this.isObject(value)) {
        const subClassName = this.generateClassName(parentClassName, key);
        // 如果还没生成过，就生成一个
        if (!generatedClasses.has(subClassName)) {
          generatedClasses.add(subClassName);
          // buildNestedClass 生成这个子类的代码
          const nestedCode = this.buildNestedClass(subClassName, value, options, generatedClasses);
          classes.push(nestedCode);

          // 递归检查更深层的内容
          classes = [
            ...classes,
            ...this.deepGenerateClasses(value, subClassName, generatedClasses, options, depth + 1),
          ];
        }
      }

      // 如果是数组
      if (Array.isArray(value) && value.length > 0) {
        const firstItem = value[0];
        if (this.isObject(firstItem)) {
          // 生成类似 "Test2Links" 等子类
          const subClassName = this.generateClassName(parentClassName, key, true);
          if (!generatedClasses.has(subClassName)) {
            generatedClasses.add(subClassName);
            const nestedCode = this.buildNestedClass(subClassName, firstItem, options, generatedClasses);
            classes.push(nestedCode);

            // 递归处理
            classes = [
              ...classes,
              ...this.deepGenerateClasses(firstItem, subClassName, generatedClasses, options, depth + 1),
            ];
          }
        }
      }
    }

    return classes;
  }

  /**
   * 构建“主类”代码
   */
  private static buildMainClass(
    className: string,
    jsonObj: any,
    options: any,
    generatedClasses: Set<string>,
  ): string {
    let code = options.equatable ? `class ${className} extends Equatable {\n` : `class ${className} {\n`;

    // 字段
    for (const [key, value] of Object.entries(jsonObj)) {
      const typeInfo = this.getDartType(value, className, generatedClasses, key, options);
      const nullableSuffix = options.nullable ? "?" : "";
      const defaultValue = options.defaultValue ? this.getDefaultValue(value) : "";
      code += `  final ${typeInfo.type}${nullableSuffix} ${key}${defaultValue};\n`;
    }

    // 构造函数
    code += `\n  ${className}({\n`;
    for (const key of Object.keys(jsonObj)) {
      const requiredPrefix = options.nullable ? "" : "required ";
      code += `    ${requiredPrefix}this.${key},\n`;
    }
    code += "  });\n\n";

    // 无参构造
    code += `  ${className}();\n\n`;

    // fromJson / toJson
    code += `  factory ${className}.fromJson(Map<String, dynamic> json) => $${className}FromJson(json);\n\n`;
    code += `  Map<String, dynamic> toJson() => $${className}ToJson(this);\n`;

    // Equatable
    if (options.equatable) {
      code += "\n  @override\n";
      code += "  List<Object?> get props => [\n";
      for (const key of Object.keys(jsonObj)) {
        code += `    ${key},\n`;
      }
      code += "  ];\n";
    }

    code += "}";
    return code;
  }

  /**
   * 构建“嵌套类”代码
   */
  private static buildNestedClass(
    className: string,
    jsonObj: any,
    options: any,
    generatedClasses: Set<string>,
  ): string {
    let code = options.equatable ? `class ${className} extends Equatable {\n` : `class ${className} {\n`;

    // 字段
    for (const [key, val] of Object.entries(jsonObj)) {
      const typeInfo = this.getDartType(val, className, generatedClasses, key, options);
      const nullableSuffix = options.nullable ? "?" : "";
      code += `  final ${typeInfo.type}${nullableSuffix} ${key};\n`;
    }

    // 构造函数
    code += `\n  ${className}({\n`;
    for (const key of Object.keys(jsonObj)) {
      const requiredPrefix = options.nullable ? "" : "required ";
      code += `    ${requiredPrefix}this.${key},\n`;
    }
    code += "  });\n\n";

    // 无参构造
    code += `  ${className}();\n\n`;

    // fromJson / toJson
    code += `  factory ${className}.fromJson(Map<String, dynamic> json) => $${className}FromJson(json);\n\n`;
    code += `  Map<String, dynamic> toJson() => $${className}ToJson(this);\n`;

    // Equatable
    if (options.equatable) {
      code += "\n  @override\n";
      code += "  List<Object?> get props => [\n";
      for (const key of Object.keys(jsonObj)) {
        code += `    ${key},\n`;
      }
      code += "  ];\n";
    }

    code += "}";
    return code;
  }

  /**
   * 根据 value 推断 Dart 类型 (带上 fieldName 用于嵌套类命名)
   */
  private static getDartType(
    value: any,
    parentClassName: string,
    generatedClasses: Set<string>,
    fieldName: string,
    options: any,
  ): { type: string; nested?: string } {
    if (value === null) {
      return { type: "dynamic" };
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        const itemType = this.getDartType(value[0], parentClassName, generatedClasses, fieldName, options).type;
        return { type: `List<${itemType}>` };
      } else {
        return { type: "List<dynamic>" };
      }
    }
    if (this.isObject(value)) {
      // 生成子类名 (e.g. "Test2Address")
      const newClassName = this.generateClassName(parentClassName, fieldName);
      generatedClasses.add(newClassName);
      return { type: newClassName, nested: newClassName };
    }

    switch (typeof value) {
      case "string":
        return { type: "String" };
      case "number":
        return { type: Number.isInteger(value) ? "int" : "double" };
      case "boolean":
        return { type: "bool" };
      default:
        return { type: "dynamic" };
    }
  }

  /**
   * 拼装子类名，如 parent="Test2", field="address" => "Test2Address"
   * 若是数组 (isArray=true)，可能把 field 单数化，但此处直接示意
   */
  private static generateClassName(parent: string, field: string, isArray = false): string {
    const singular = isArray ? this.singularize(field) : field;
    return `${parent}${this.capitalize(singular)}`;
  }

  private static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private static singularize(str: string): string {
    return str.endsWith("s") ? str.slice(0, -1) : str;
  }

  private static isObject(value: any): boolean {
    return typeof value === "object" && !Array.isArray(value) && value !== null;
  }

  /**
   * 给默认值
   */
  private static getDefaultValue(value: any): string {
    if (value === null) {
      return " = null";
    }
    switch (typeof value) {
      case "string":
        return ` = '${value}'`;
      case "number":
      case "boolean":
        return ` = ${value}`;
      case "object":
        if (Array.isArray(value)) {
          return " = const []";
        }
        return " = const {}";
      default:
        return "";
    }
  }
}
