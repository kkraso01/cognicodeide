import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  language: string;
  initialValue?: string;
  value?: string;  // NEW: Controlled value for replay
  onChange?: (value: string | undefined) => void;
  onPaste?: (content: string) => void;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  language,
  initialValue = '',
  value,  // NEW: Controlled value
  onChange,
  onPaste,
  readOnly = false,
}) => {
  const [code, setCode] = useState(value !== undefined ? value : initialValue);
  const editorRef = useRef<any>(null);

  // Update code when value prop changes (for replay)
  useEffect(() => {
    if (value !== undefined && value !== code) {
      setCode(value);
      // Update editor content if it's mounted
      if (editorRef.current) {
        const currentValue = editorRef.current.getValue();
        if (currentValue !== value) {
          editorRef.current.setValue(value);
        }
      }
    }
  }, [value, code]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Register comprehensive language-specific completions
    const monacoLang = getLanguageForMonaco(language);
    
    if (monacoLang === 'python') {
      monaco.languages.registerCompletionItemProvider('python', {
        provideCompletionItems: () => {
          const suggestions = [
            // Keywords
            { label: 'def', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'def ${1:function_name}(${2:params}):\n    ${3:pass}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Define a function' },
            { label: 'class', kind: monaco.languages.CompletionItemKind.Class, insertText: 'class ${1:ClassName}:\n    def __init__(self${2:, args}):\n        ${3:pass}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Define a class' },
            { label: 'if', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'if ${1:condition}:\n    ${2:pass}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'elif', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'elif ${1:condition}:\n    ${2:pass}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'else', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'else:\n    ${1:pass}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'for', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'for ${1:item} in ${2:iterable}:\n    ${3:pass}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'while', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'while ${1:condition}:\n    ${2:pass}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'try', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:pass}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'with', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'with ${1:expression} as ${2:var}:\n    ${3:pass}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'lambda', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'lambda ${1:args}: ${2:expression}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'return', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'return ${1:value}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'yield', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'yield ${1:value}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'import', kind: monaco.languages.CompletionItemKind.Module, insertText: 'import ${1:module}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'from', kind: monaco.languages.CompletionItemKind.Module, insertText: 'from ${1:module} import ${2:name}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Built-in Functions
            { label: 'print', kind: monaco.languages.CompletionItemKind.Function, insertText: 'print(${1:})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Print to console' },
            { label: 'len', kind: monaco.languages.CompletionItemKind.Function, insertText: 'len(${1:})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Return length of object' },
            { label: 'range', kind: monaco.languages.CompletionItemKind.Function, insertText: 'range(${1:stop})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Generate sequence of numbers' },
            { label: 'input', kind: monaco.languages.CompletionItemKind.Function, insertText: 'input(${1:prompt})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Read input from user' },
            { label: 'open', kind: monaco.languages.CompletionItemKind.Function, insertText: 'open(${1:file}, ${2:mode})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Open file' },
            { label: 'enumerate', kind: monaco.languages.CompletionItemKind.Function, insertText: 'enumerate(${1:iterable})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'zip', kind: monaco.languages.CompletionItemKind.Function, insertText: 'zip(${1:iterable1}, ${2:iterable2})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'map', kind: monaco.languages.CompletionItemKind.Function, insertText: 'map(${1:function}, ${2:iterable})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'filter', kind: monaco.languages.CompletionItemKind.Function, insertText: 'filter(${1:function}, ${2:iterable})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'sorted', kind: monaco.languages.CompletionItemKind.Function, insertText: 'sorted(${1:iterable})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'sum', kind: monaco.languages.CompletionItemKind.Function, insertText: 'sum(${1:iterable})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'max', kind: monaco.languages.CompletionItemKind.Function, insertText: 'max(${1:})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'min', kind: monaco.languages.CompletionItemKind.Function, insertText: 'min(${1:})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'abs', kind: monaco.languages.CompletionItemKind.Function, insertText: 'abs(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'round', kind: monaco.languages.CompletionItemKind.Function, insertText: 'round(${1:number}, ${2:ndigits})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'int', kind: monaco.languages.CompletionItemKind.Constructor, insertText: 'int(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'float', kind: monaco.languages.CompletionItemKind.Constructor, insertText: 'float(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'str', kind: monaco.languages.CompletionItemKind.Constructor, insertText: 'str(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'list', kind: monaco.languages.CompletionItemKind.Constructor, insertText: 'list(${1:iterable})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'dict', kind: monaco.languages.CompletionItemKind.Constructor, insertText: 'dict(${1:})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'set', kind: monaco.languages.CompletionItemKind.Constructor, insertText: 'set(${1:iterable})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'tuple', kind: monaco.languages.CompletionItemKind.Constructor, insertText: 'tuple(${1:iterable})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'isinstance', kind: monaco.languages.CompletionItemKind.Function, insertText: 'isinstance(${1:obj}, ${2:class})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'type', kind: monaco.languages.CompletionItemKind.Function, insertText: 'type(${1:obj})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // List methods
            { label: 'append', kind: monaco.languages.CompletionItemKind.Method, insertText: 'append(${1:item})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Add item to end of list' },
            { label: 'extend', kind: monaco.languages.CompletionItemKind.Method, insertText: 'extend(${1:iterable})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'insert', kind: monaco.languages.CompletionItemKind.Method, insertText: 'insert(${1:index}, ${2:item})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'remove', kind: monaco.languages.CompletionItemKind.Method, insertText: 'remove(${1:item})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'pop', kind: monaco.languages.CompletionItemKind.Method, insertText: 'pop(${1:index})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'clear', kind: monaco.languages.CompletionItemKind.Method, insertText: 'clear()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'index', kind: monaco.languages.CompletionItemKind.Method, insertText: 'index(${1:item})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'count', kind: monaco.languages.CompletionItemKind.Method, insertText: 'count(${1:item})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'sort', kind: monaco.languages.CompletionItemKind.Method, insertText: 'sort()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'reverse', kind: monaco.languages.CompletionItemKind.Method, insertText: 'reverse()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'copy', kind: monaco.languages.CompletionItemKind.Method, insertText: 'copy()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // String methods
            { label: 'split', kind: monaco.languages.CompletionItemKind.Method, insertText: 'split(${1:separator})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'join', kind: monaco.languages.CompletionItemKind.Method, insertText: 'join(${1:iterable})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'replace', kind: monaco.languages.CompletionItemKind.Method, insertText: 'replace(${1:old}, ${2:new})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'strip', kind: monaco.languages.CompletionItemKind.Method, insertText: 'strip()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'lstrip', kind: monaco.languages.CompletionItemKind.Method, insertText: 'lstrip()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'rstrip', kind: monaco.languages.CompletionItemKind.Method, insertText: 'rstrip()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'lower', kind: monaco.languages.CompletionItemKind.Method, insertText: 'lower()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'upper', kind: monaco.languages.CompletionItemKind.Method, insertText: 'upper()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'capitalize', kind: monaco.languages.CompletionItemKind.Method, insertText: 'capitalize()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'title', kind: monaco.languages.CompletionItemKind.Method, insertText: 'title()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'startswith', kind: monaco.languages.CompletionItemKind.Method, insertText: 'startswith(${1:prefix})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'endswith', kind: monaco.languages.CompletionItemKind.Method, insertText: 'endswith(${1:suffix})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'find', kind: monaco.languages.CompletionItemKind.Method, insertText: 'find(${1:substring})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'format', kind: monaco.languages.CompletionItemKind.Method, insertText: 'format(${1:})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'isalpha', kind: monaco.languages.CompletionItemKind.Property, insertText: 'isalpha()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'isdigit', kind: monaco.languages.CompletionItemKind.Property, insertText: 'isdigit()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'isalnum', kind: monaco.languages.CompletionItemKind.Property, insertText: 'isalnum()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Dict methods
            { label: 'keys', kind: monaco.languages.CompletionItemKind.Method, insertText: 'keys()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'values', kind: monaco.languages.CompletionItemKind.Method, insertText: 'values()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'items', kind: monaco.languages.CompletionItemKind.Method, insertText: 'items()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'get', kind: monaco.languages.CompletionItemKind.Method, insertText: 'get(${1:key}, ${2:default})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'update', kind: monaco.languages.CompletionItemKind.Method, insertText: 'update(${1:dict})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Constants
            { label: 'True', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'True' },
            { label: 'False', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'False' },
            { label: 'None', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'None' },
            // Common snippets
            { label: 'ifmain', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'if __name__ == "__main__":\n    ${1:main()}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'if main guard' },
            { label: 'listcomp', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '[${1:x} for ${2:x} in ${3:iterable}]', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'List comprehension' },
            { label: 'dictcomp', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '{${1:k}: ${2:v} for ${3:k}, ${4:v} in ${5:iterable}}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Dict comprehension' },
          ];
          return { suggestions };
        },
      });
    } else if (monacoLang === 'java') {
      monaco.languages.registerCompletionItemProvider('java', {
        provideCompletionItems: () => {
          const suggestions = [
            // Class and method templates
            { label: 'class', kind: monaco.languages.CompletionItemKind.Class, insertText: 'public class ${1:ClassName} {\n    ${2}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Create class' },
            { label: 'interface', kind: monaco.languages.CompletionItemKind.Interface, insertText: 'public interface ${1:InterfaceName} {\n    ${2}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'enum', kind: monaco.languages.CompletionItemKind.Enum, insertText: 'public enum ${1:EnumName} {\n    ${2}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'public static void main(String[] args) {\n    ${1}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Main method' },
            { label: 'sysout', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'System.out.println(${1});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Print to console' },
            { label: 'syserr', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'System.err.println(${1});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Control flow
            { label: 'if', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'if (${1:condition}) {\n    ${2}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'ifelse', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'if (${1:condition}) {\n    ${2}\n} else {\n    ${3}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'for', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'for (${1:int i = 0}; ${2:i < length}; ${3:i++}) {\n    ${4}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'foreach', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'for (${1:Type} ${2:item} : ${3:collection}) {\n    ${4}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'while', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'while (${1:condition}) {\n    ${2}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'dowhile', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'do {\n    ${1}\n} while (${2:condition});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'switch', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'switch (${1:expression}) {\n    case ${2:value}:\n        ${3}\n        break;\n    default:\n        ${4}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'try', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'try {\n    ${1}\n} catch (${2:Exception} ${3:e}) {\n    ${4}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'tryfinally', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'try {\n    ${1}\n} catch (${2:Exception} ${3:e}) {\n    ${4}\n} finally {\n    ${5}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Methods
            { label: 'method', kind: monaco.languages.CompletionItemKind.Method, insertText: 'public ${1:void} ${2:methodName}(${3:}) {\n    ${4}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'constructor', kind: monaco.languages.CompletionItemKind.Constructor, insertText: 'public ${1:ClassName}(${2:}) {\n    ${3}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Common methods
            { label: 'System.out.println', kind: monaco.languages.CompletionItemKind.Method, insertText: 'System.out.println(${1});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'System.out.print', kind: monaco.languages.CompletionItemKind.Method, insertText: 'System.out.print(${1});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'toString', kind: monaco.languages.CompletionItemKind.Method, insertText: 'toString()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'equals', kind: monaco.languages.CompletionItemKind.Method, insertText: 'equals(${1:obj})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'hashCode', kind: monaco.languages.CompletionItemKind.Method, insertText: 'hashCode()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'length', kind: monaco.languages.CompletionItemKind.Method, insertText: 'length()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'size', kind: monaco.languages.CompletionItemKind.Method, insertText: 'size()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'isEmpty', kind: monaco.languages.CompletionItemKind.Method, insertText: 'isEmpty()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'substring', kind: monaco.languages.CompletionItemKind.Method, insertText: 'substring(${1:start}, ${2:end})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'charAt', kind: monaco.languages.CompletionItemKind.Method, insertText: 'charAt(${1:index})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'toLowerCase', kind: monaco.languages.CompletionItemKind.Method, insertText: 'toLowerCase()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'toUpperCase', kind: monaco.languages.CompletionItemKind.Method, insertText: 'toUpperCase()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'trim', kind: monaco.languages.CompletionItemKind.Method, insertText: 'trim()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'split', kind: monaco.languages.CompletionItemKind.Method, insertText: 'split(${1:regex})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'replace', kind: monaco.languages.CompletionItemKind.Method, insertText: 'replace(${1:target}, ${2:replacement})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'contains', kind: monaco.languages.CompletionItemKind.Method, insertText: 'contains(${1:element})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'add', kind: monaco.languages.CompletionItemKind.Method, insertText: 'add(${1:element})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'remove', kind: monaco.languages.CompletionItemKind.Method, insertText: 'remove(${1:element})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'get', kind: monaco.languages.CompletionItemKind.Method, insertText: 'get(${1:index})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'set', kind: monaco.languages.CompletionItemKind.Method, insertText: 'set(${1:index}, ${2:element})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Types/Classes
            { label: 'String', kind: monaco.languages.CompletionItemKind.Class, insertText: 'String' },
            { label: 'Integer', kind: monaco.languages.CompletionItemKind.Class, insertText: 'Integer' },
            { label: 'Double', kind: monaco.languages.CompletionItemKind.Class, insertText: 'Double' },
            { label: 'Boolean', kind: monaco.languages.CompletionItemKind.Class, insertText: 'Boolean' },
            { label: 'List', kind: monaco.languages.CompletionItemKind.Class, insertText: 'List<${1:Type}>' },
            { label: 'ArrayList', kind: monaco.languages.CompletionItemKind.Class, insertText: 'ArrayList<${1:Type}>' },
            { label: 'HashMap', kind: monaco.languages.CompletionItemKind.Class, insertText: 'HashMap<${1:Key}, ${2:Value}>' },
            { label: 'HashSet', kind: monaco.languages.CompletionItemKind.Class, insertText: 'HashSet<${1:Type}>' },
            // Keywords
            { label: 'public', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'public ' },
            { label: 'private', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'private ' },
            { label: 'protected', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'protected ' },
            { label: 'static', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'static ' },
            { label: 'final', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'final ' },
            { label: 'abstract', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'abstract ' },
            { label: 'extends', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'extends ${1:SuperClass}' },
            { label: 'implements', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'implements ${1:Interface}' },
            { label: 'new', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'new ${1:Type}(${2:})' },
            { label: 'return', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'return ${1:};' },
            { label: 'this', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'this' },
            { label: 'super', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'super' },
            { label: 'null', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'null' },
            { label: 'true', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'true' },
            { label: 'false', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'false' },
          ];
          return { suggestions };
        },
      });
    } else if (monacoLang === 'c' || monacoLang === 'cpp') {
      monaco.languages.registerCompletionItemProvider(monacoLang, {
        provideCompletionItems: () => {
          const suggestions = [
            // Main and includes
            { label: 'main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'int main() {\n    ${1}\n    return 0;\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Main function' },
            { label: 'include', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '#include <${1:stdio.h}>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'define', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '#define ${1:NAME} ${2:value}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // I/O functions
            { label: 'printf', kind: monaco.languages.CompletionItemKind.Function, insertText: 'printf("${1}", ${2});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Print formatted output' },
            { label: 'scanf', kind: monaco.languages.CompletionItemKind.Function, insertText: 'scanf("${1}", ${2});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Read formatted input' },
            { label: 'fprintf', kind: monaco.languages.CompletionItemKind.Function, insertText: 'fprintf(${1:stream}, "${2}", ${3});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'fscanf', kind: monaco.languages.CompletionItemKind.Function, insertText: 'fscanf(${1:stream}, "${2}", ${3});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'puts', kind: monaco.languages.CompletionItemKind.Function, insertText: 'puts(${1:string});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'gets', kind: monaco.languages.CompletionItemKind.Function, insertText: 'gets(${1:buffer});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'fgets', kind: monaco.languages.CompletionItemKind.Function, insertText: 'fgets(${1:buffer}, ${2:size}, ${3:stream});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'fputs', kind: monaco.languages.CompletionItemKind.Function, insertText: 'fputs(${1:string}, ${2:stream});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Control flow
            { label: 'if', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'if (${1:condition}) {\n    ${2}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'ifelse', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'if (${1:condition}) {\n    ${2}\n} else {\n    ${3}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'for', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'for (${1:int i = 0}; ${2:i < n}; ${3:i++}) {\n    ${4}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'while', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'while (${1:condition}) {\n    ${2}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'dowhile', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'do {\n    ${1}\n} while (${2:condition});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'switch', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'switch (${1:expression}) {\n    case ${2:value}:\n        ${3}\n        break;\n    default:\n        ${4}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Memory management
            { label: 'malloc', kind: monaco.languages.CompletionItemKind.Function, insertText: 'malloc(${1:size})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Allocate memory' },
            { label: 'calloc', kind: monaco.languages.CompletionItemKind.Function, insertText: 'calloc(${1:count}, ${2:size})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'realloc', kind: monaco.languages.CompletionItemKind.Function, insertText: 'realloc(${1:ptr}, ${2:size})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'free', kind: monaco.languages.CompletionItemKind.Function, insertText: 'free(${1:ptr});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Free allocated memory' },
            { label: 'sizeof', kind: monaco.languages.CompletionItemKind.Function, insertText: 'sizeof(${1:type})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // String functions
            { label: 'strlen', kind: monaco.languages.CompletionItemKind.Function, insertText: 'strlen(${1:str})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'strcpy', kind: monaco.languages.CompletionItemKind.Function, insertText: 'strcpy(${1:dest}, ${2:src})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'strncpy', kind: monaco.languages.CompletionItemKind.Function, insertText: 'strncpy(${1:dest}, ${2:src}, ${3:n})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'strcat', kind: monaco.languages.CompletionItemKind.Function, insertText: 'strcat(${1:dest}, ${2:src})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'strcmp', kind: monaco.languages.CompletionItemKind.Function, insertText: 'strcmp(${1:str1}, ${2:str2})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'strstr', kind: monaco.languages.CompletionItemKind.Function, insertText: 'strstr(${1:haystack}, ${2:needle})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'memcpy', kind: monaco.languages.CompletionItemKind.Function, insertText: 'memcpy(${1:dest}, ${2:src}, ${3:n})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'memset', kind: monaco.languages.CompletionItemKind.Function, insertText: 'memset(${1:ptr}, ${2:value}, ${3:n})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Math functions
            { label: 'abs', kind: monaco.languages.CompletionItemKind.Function, insertText: 'abs(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'pow', kind: monaco.languages.CompletionItemKind.Function, insertText: 'pow(${1:base}, ${2:exp})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'sqrt', kind: monaco.languages.CompletionItemKind.Function, insertText: 'sqrt(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'ceil', kind: monaco.languages.CompletionItemKind.Function, insertText: 'ceil(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'floor', kind: monaco.languages.CompletionItemKind.Function, insertText: 'floor(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // File operations
            { label: 'fopen', kind: monaco.languages.CompletionItemKind.Function, insertText: 'fopen("${1:filename}", "${2:mode}")', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'fclose', kind: monaco.languages.CompletionItemKind.Function, insertText: 'fclose(${1:file});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'fread', kind: monaco.languages.CompletionItemKind.Function, insertText: 'fread(${1:ptr}, ${2:size}, ${3:count}, ${4:stream})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'fwrite', kind: monaco.languages.CompletionItemKind.Function, insertText: 'fwrite(${1:ptr}, ${2:size}, ${3:count}, ${4:stream})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Struct
            { label: 'struct', kind: monaco.languages.CompletionItemKind.Struct, insertText: 'struct ${1:Name} {\n    ${2}\n};', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'typedef', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'typedef ${1:type} ${2:name};', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            // Keywords
            { label: 'return', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'return ${1:};' },
            { label: 'break', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'break;' },
            { label: 'continue', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'continue;' },
            { label: 'NULL', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'NULL' },
          ];
          return { suggestions };
        },
      });
    }

    // Track paste events
    editor.onDidPaste((e: any) => {
      if (onPaste) {
        const pastedText = editor.getModel()?.getValueInRange(e.range) || '';
        onPaste(pastedText);
      }
    });

    // Track model content changes (fired on EVERY keystroke)
    editor.onDidChangeModelContent(() => {
      if (onChange) {
        const newValue = editor.getValue();
        onChange(newValue);
      }
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    // This is only for initial setup - actual changes are handled by onDidChangeModelContent
    setCode(value || '');
  };

  const getLanguageForMonaco = (lang: string): string => {
    const langMap: { [key: string]: string } = {
      python: 'python',
      c: 'c',
      cpp: 'cpp',
      java: 'java',
      javascript: 'javascript',
      typescript: 'typescript',
    };
    return langMap[lang.toLowerCase()] || 'plaintext';
  };

  return (
    <div className="editor-container">
      <Editor
        height="100%"
        language={getLanguageForMonaco(language)}
        value={code}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          wordBasedSuggestions: 'currentDocument',
          suggest: {
            showWords: true,
            showKeywords: true,
            showSnippets: true,
          },
          parameterHints: {
            enabled: true,
          },
          acceptSuggestionOnEnter: 'on',
          tabCompletion: 'on',
        }}
      />
    </div>
  );
};

