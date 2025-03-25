"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DartGenerator = void 0;
/**
 * Utility class for generating Dart bean classes from JSON
 */
class DartGenerator {
    /**
     * Generate a Dart class from JSON
     * @param className The name of the class
     * @param jsonText The JSON text to parse
     * @param options Generation options
     * @returns The generated Dart class code
     */
    static generateClass(className, jsonText, options) {
        try {
            const jsonObj = JSON.parse(jsonText);
            let dartCode = "";
            // Add imports
            dartCode += "import 'package:json_annotation/json_annotation.dart';\n";
            if (options.equatable) {
                dartCode += "import 'package:equatable/equatable.dart';\n";
            }
            dartCode += "\npart '" + className.toLowerCase() + ".g.dart';\n\n";
            // Add class annotation
            dartCode += "@JsonSerializable()\n";
            // Start class definition
            if (options.equatable) {
                dartCode += `class ${className} extends Equatable {\n`;
            }
            else {
                dartCode += `class ${className} {\n`;
            }
            // Add fields
            for (const [key, value] of Object.entries(jsonObj)) {
                const dartType = this.getDartType(value);
                const nullableSuffix = options.nullable ? "?" : "";
                if (options.defaultValue) {
                    const defaultVal = this.getDefaultValue(value);
                    dartCode += `  final ${dartType}${nullableSuffix} ${key}${defaultVal};\n`;
                }
                else {
                    dartCode += `  final ${dartType}${nullableSuffix} ${key};\n`;
                }
            }
            dartCode += "\n";
            // Add constructor
            dartCode += `  ${className}({\n`;
            for (const key of Object.keys(jsonObj)) {
                const requiredPrefix = options.nullable ? "" : "required ";
                dartCode += `    ${requiredPrefix}this.${key},\n`;
            }
            dartCode += "  });\n\n";
            // Add fromJson and toJson methods
            dartCode += `  factory ${className}.fromJson(Map<String, dynamic> json) => _$${className}FromJson(json);\n`;
            dartCode += `  Map<String, dynamic> toJson() => _$${className}ToJson(this);\n`;
            // Add props for Equatable
            if (options.equatable) {
                dartCode += "\n  @override\n";
                dartCode += "  List<Object?> get props => [\n";
                for (const key of Object.keys(jsonObj)) {
                    dartCode += `    ${key},\n`;
                }
                dartCode += "  ];\n";
            }
            // Close class
            dartCode += "}\n";
            return dartCode;
        }
        catch (e) {
            throw new Error(`Failed to generate Dart class: ${e.message}`);
        }
    }
    /**
     * Get the Dart type for a JSON value
     */
    static getDartType(value) {
        if (value === null) {
            return "dynamic";
        }
        switch (typeof value) {
            case "string":
                return "String";
            case "number":
                return Number.isInteger(value) ? "int" : "double";
            case "boolean":
                return "bool";
            case "object":
                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        const itemType = this.getDartType(value[0]);
                        return `List<${itemType}>`;
                    }
                    return "List<dynamic>";
                }
                return "Map<String, dynamic>";
            default:
                return "dynamic";
        }
    }
    /**
     * Get default value string for a JSON value
     */
    static getDefaultValue(value) {
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
exports.DartGenerator = DartGenerator;
//# sourceMappingURL=dart-generator.js.map