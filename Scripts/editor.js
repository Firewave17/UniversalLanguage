const PREDEFINED = {
	"Print": `<Statement>(🗩<Whitespace><Expression d>)
⋐
	app.log(d);
⋑`,
	"Expression": `<Monomial>(<Number x>)
⋐
	return x;
⋑
<Monomial>(<Monomial x><Whitespace>⊙<Whitespace><Monomial y>)
⋐
	return x * y;
⋑
<Monomial>(<Monomial x><Whitespace>⊘<Whitespace><Monomial y>)
⋐
	return x / y;
⋑
<Polynomial>(<Monomial x>)
⋐
	return x;
⋑
<Polynomial>(<Polynomial x><Whitespace>⊕<Whitespace><Polynomial y>)
⋐
	return x + y;
⋑
<Expression>(<Word a>)
⋐
	return a;
⋑
<Expression>(<Polynomial x>)
⋐
	return x;
⋑`,
	"Comment": `
<Statement>(⊗<* comment>
)
⋐
	return;
⋑`,
	"Vector": `<Vector>(⊂<Number x>,<Number y>⊃)
⋐
	return {x: x, y: y};
⋑
<Vector>(<Vector x><Whitespace>⊕<Whitespace><Vector y>)
⋐
	return {x: x.x + y.x, y: x.y + y.y};
⋑
<Monomial>(〈<Vector v>〉)
⋐
	return (v.x**2 + v.y**2)**.5;
⋑`,
};

class Interpreter {
	constructor() {
		this.functionNodes = [];
		this.string = "";
		this.compiledCode = "";
		this.index = 0;
		
		var whitespaceCharNode = new FunctionNode("WhitespaceChar");
		for (var char of " \t\n") {
			whitespaceCharNode.addDefinition(char, `return "";`);
		}
		this.functionNodes.push(whitespaceCharNode);

		var whitespaceNode = new FunctionNode("Whitespace");
		whitespaceNode.addDefinition("[<WhitespaceChar w>|*]", `return "";`);
		this.functionNodes.push(whitespaceNode);

		var letterNode = new FunctionNode("Letter");
		for (var char of "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
			letterNode.addDefinition(char, `return "${char}";`);
		}
		this.functionNodes.push(letterNode);

		var wordNode = new FunctionNode("Word");
		wordNode.addDefinition("[<Letter l>|*]", `
		var string = "";
		for (var letter of l) {
			string += letter;
		}
		return string;
		`);
		this.functionNodes.push(wordNode);

		var digitNode = new FunctionNode("Digit");
		for (var char of "0123456789") {
			digitNode.addDefinition(char, `return ${+char}`);
		}
		this.functionNodes.push(digitNode);

		var numberNode = new FunctionNode("Number");
		numberNode.addDefinition("<Digit d0>[<Digit d>|*]", `
		var number = 6**d.length*d0;
		for (var i = 0; i < d.length; i++) {
			number += 6**(d.length - 1 - i)*d[i];
		}
		return number;
		`);
		numberNode.addDefinition("-<Number n>", `return -n;`);
		this.functionNodes.push(numberNode);

		// var patternPrimNode = new FunctionNode("PatternPrimative");
		// patternPrimNode.addDefinition("<Whitespace>", `return ""`);
		// patternPrimNode.addDefinition("<Letter char>", `return char;`);
		// patternPrimNode.addDefinition("\\<<Word type> <Word object>\\>", `
		// 	return \`<\${type} \${object}>\`;
		// `);
		// patternPrimNode.addDefinition("\\<* <Word object>\\>", `
		// 	return \`<* \${object}>\`;
		// `);
		// patternPrimNode.addDefinition("\\<<Word type>\\>", `
		// 	return \`<\${type}>\`;
		// `);
		// patternPrimNode.addDefinition("\\[<Pattern p>|* <Word w>\\]", `
		// 	return \`[\${p}|* w]\`;
		// `);
		// this.functionNodes.push(patternPrimNode);

		// var patternNode = new FunctionNode("Pattern");
		// patternNode.addDefinition(`[<PatternPrimative pp>|* P]`, `
		// 	var string = "";
		// 	var i = 0;
		// 	while (true) {
		// 		var exists = eval(\`typeof pp\${i}\`) !== "undefined";
		// 		if (!exists) break;
		// 		string += eval(\`pp\${i}\`);
		// 		i++;
		// 	}
		// 	return string;
		// `);
		// patternNode.addDefinition(`(<* p>)`, `
		// 	return p;
		// `);
		// this.functionNodes.push(patternNode);

		var defNode = new FunctionNode("Definition");
		defNode.addDefinition(`\\<<* funcname>\\>(<* p>)<Whitespace>⋐<* j>⋑`, `
			var existingNode = interpreter.getNode(funcname);
			j = j.trim();
			if (existingNode) {
				existingNode.addDefinition(p, j);
			} else {
				var node = new FunctionNode(funcname);
				node.addDefinition(p, j);
				interpreter.functionNodes.push(node);
			}
		`);
		this.functionNodes.push(defNode);

		var importNode = new FunctionNode("Import");
		importNode.addDefinition("⭳<* name>⭳", `
			var string = interpreter.string;
			var index = interpreter.index;
			interpreter.run(PREDEFINED[name]+"~");
			interpreter.string = string;
			interpreter.index = index;
			return;
		`);
		this.functionNodes.push(importNode);

		var statementNode = new FunctionNode("Statement");
		statementNode.addDefinition("<WhitespaceChar>", `return;`);
		statementNode.addDefinition("<Definition d>", `return d;`);
		statementNode.addDefinition("<Import i>", `return i;`);
		this.functionNodes.push(statementNode);
	}
	match(name, pattern, trace=[]) {
		var startIndex = this.index;
		var newNode = new FunctionNode(name);
		var tokens = Token.tokenizePattern(pattern);
		for (var i = 0; i < tokens.length; i++) {
			if (this.index >= this.string.length) return;
			var token = tokens[i];
			switch (token.tokenType) {
				case "char":
					if (token.pattern == this.string[this.index]) {
						this.index++;
					} else {
						this.index = startIndex;
						return null;
					}
					break;
				case "function":
					if (token.functionName == '*') {
						// FIX check for bad input
						var nextToken = tokens[i + 1];
						var functionStartindex = this.index;
						while (true) {
							var tempIndex = this.index;
							var node = this.match("free", nextToken.pattern, trace);
							this.index = tempIndex;
							if (node) break;
							this.index++;
						}
						var string = this.string.substring(functionStartindex, this.index);
						if (token.objectName) {
							var functionNode = new FunctionNode("*");
							functionNode.definition = new Definition("", `return \`${string}\``);
							newNode.variables[token.objectName] = functionNode;
						}
					} else if (token.functionName == '~') {
						var string = this.string[this.index];
						this.index++;
						if (token.objectName) {
							var functionNode = new FunctionNode("~");
							functionNode.definition = new Definition("", `return \`${string}\``);
							newNode.variables[token.objectName] = functionNode;
						}
					} else {
						var newTrace = (i == 0) ? trace : [];
						var functionNode = this.findMatch(token.functionName, newTrace);
						if (!functionNode) {
							this.index = startIndex;
							return null;
						}
						if (token.objectName) {
							newNode.variables[token.objectName] = functionNode;
						}
					}
					break;
				case "list":
					var elements = [];
					var element;
					var j = 0;
					while (true) {
						j++;
						element = this.match(`${j}`, token.listPattern, trace);
						if (element) elements.push(element);
						else if (token.listRepeat != '*' && j != +token.listRepeat) {
							this.index = startIndex;
							return null;
						} else break;
					}
					var variables = {};
					var patternTokens = Token.tokenizePattern(token.listPattern);
					for (var token0 of patternTokens) {
						if (token0.objectName) {
							variables[token0.objectName] = [];
						}
					}
					for (var variable of Object.keys(variables)) {
						var variableNode = new FunctionNode();
						var string = "[";
						for (let i = 0; i < elements.length; i++) {
							variableNode.variables[variable + i] = elements[i].variables[variable];
							string += variable + i + ",";
						}
						string += "]";
						variableNode.definition = new Definition("", `return ${string}`);
						newNode.variables[variable] = variableNode;
					}
					break;
				default:
					console.error("Unknown token type");
					return;
			}
		}
		return newNode;
	}
	getNode(name) {
		for (var node of this.functionNodes) {
			if (node.name == name) {
				return node;
			}
		}
		return null;
	}
	findMatch(name, trace=[]) {
		var node = this.getNode(name);
		if (!node) {
			console.error(`Could not find pattern with name ${name}`);
			return null;
		}
		// if (trace.includes(name)) {
		// 	console.log(trace, name, node.definitions);
		// 	return null;
		// }
		for (var definition of node.definitions) {
			if (trace.includes(definition.pattern)) {
				// console.log(trace, definition.pattern);
				continue;
			}
			var n = this.match(name, definition.pattern, trace.concat(definition.pattern));
			if (n) {
				n.definition = definition;
				return n;
			}
		}
		return null;
	}
	interpret(node) {
		if (!node.definition) {
			console.error(`Unknown definition for ${node}`);
			return;
		}
		var names = [];
		var values = [];
		for (var v of Object.keys(node.variables)) {
			names.push(v);
			values.push(this.interpret(node.variables[v]));
		}
		var f = new Function(`interpreter`, ...names, node.definition.interpretation.trim());
		// this.compiledCode += f.toString().match(/function[^{]+\{([\s\S]*)\}$/)[1];
		var string = this.string;
		var index = this.index;
		var value = f(this, ...values);
		this.string = string;
		this.index = index;
		return value;
	}
	run(string) {
		this.string = string;
		this.index = 0;

		var statement;
		while (true) {
			statement = this.findMatch("Statement");
			if (!statement) break;
			this.interpret(statement);
		}
	}
}

class Token {
	constructor() {
		this.tokenType;
		this.pattern;
	}
	static tokenizePattern(pattern) {
		var tokens = [];
		var i = 0;
		while (i < pattern.length) {
			var char = pattern[i];
			var token = new Token();
			switch (char) {
				case '<':
					token.tokenType = "function";

					i++;
					var end = pattern.indexOf('>', i);
					if (end == -1) {
						console.error("Syntax error: Could not find '>'");
						return;
					}
					var inside = pattern.substr(i, end - i);
					var components = inside.split(" ");
					if (components.length != 1 && components.length != 2) {
						console.error(`Syntax error: Found ${components.length} components instead of 2`);
						return;
					}
					token.functionName = components[0]
					if (components.length == 2) {
						token.objectName = components[1];
					} else {
						token.objectName = null;
					}
					token.pattern = pattern.substring(i - 1, end + 1)
					i = end + 1;
					break;
				case '[':
					token.tokenType = "list";

					i++;
					var end = pattern.indexOf(']', i);
					if (end == -1) {
						console.error("Syntax error: Could not find '>'");
						return;
					}
					var inside = pattern.substr(i, end - i);
					var components = inside.split('|');
					if (components.length != 2) {
						console.error(`Syntax error: found ${components.length} components instead of 2`);
						return;
					}
					token.listPattern = components[0];
					var rightComponents = components[1].split(" ");
					token.functionName = null;
					switch (rightComponents.length) {
						case 2:
							token.functionName = rightComponents[1];
						case 1:
							token.listRepeat = rightComponents[0];
							break;
						default:
							console.error(`Syntax error: found ${components.length} components instead of 2`);
							return;
					}
					token.pattern = pattern.substring(i - 1, end + 1)
					i = end + 1;
					break;
				case '\\':
					i++;
				default:
					token.tokenType = "char";
					token.pattern = pattern[i];
					i++;
					break;
			}
			tokens.push(token);
		}
		return tokens;
	}
}


class FunctionNode {
	constructor(name) {
		this.name = name;
		this.definitions = [];
		this.definition = null;
		this.variables = {};
	}
	addDefinition(pattern, interpretation) {
		this.definitions.unshift(new Definition(pattern, interpretation));
	}
	getDefinition(pattern) {
		for (var d of this.definitions) {
			if (d.pattern == pattern) return d.definition;
		}
		return null;
	}
}

class Definition {
	constructor(pattern, interpretation) {
		this.pattern = pattern;
		this.interpretation = interpretation;
	}
}

var app = new Vue({
	el: "#app",
	data: {
		interpreter: new Interpreter(),
		inputDefinitionEditor: "",
		inputCodeEdtior: "",
		outputCompiledCode: "",
		outputTerminal: "> ",
		keyBindings: {},
		inputKeyBind: "",
		currentBinding: "",
		symbols: ["⭳", "🗩", "⬡", "□", "△", "▵", "·", "〈", "〉", "⌊", "⌋", "⊂", "⊃", "⋐", "⋑", "∩", "∪", "⏵", "⏸", "⊕", "⊗", "⊙", "⊘", "«", "»", "⊏", "⊐"],
	},
	methods: {
		log: function(text) {
			this.outputTerminal += text + "\n" + "> ";
		},
		clear: function() {
			this.outputTerminal = "> ";
		},
		symbolClicked: function(e, symbol) {
			var textarea = document.querySelector("textarea");
			textarea.focus();
			textarea.setRangeText(symbol, textarea.selectionStart, textarea.selectionStart, "end");
		},
		symbolRightClicked: function(e, symbol) {
			e.preventDefault();
			this.currentBinding = symbol;
			this.inputKeyBind = "";
			this.$refs.keyBindInput.focus();
		},
		bindSymbol: function(e) {
			e.preventDefault();
			this.keyBindings[`${this.inputKeyBind}`] = this.currentBinding;
			this.inputKeyBind = "";
			this.$refs.editor.focus();
		},
		runCode: function () {
			this.interpreter = new Interpreter();
			this.inputDefinitionEditor = this.$refs.definitionEditor.value;
			this.interpreter.run(this.inputDefinitionEditor + "~");
			this.outputCompiledCode = this.interpreter.compiledCode;
			// this.interpreter.run(this.inputCodeEdtior + "~");
		},
		tabPressed: function(e) {
			e.preventDefault();
			var textarea = e.target;
			textarea.setRangeText("\t", textarea.selectionStart, textarea.selectionStart, "end");
		},
		keyDown: function(e) {
			var key = e.key;
			if (key.length == 1 && !e.ctrlKey && key in this.keyBindings) {
				e.preventDefault();
				key = this.keyBindings[key];
				var textarea = e.target;
				textarea.setRangeText(key, textarea.selectionStart, textarea.selectionStart, "end");
			}
		},
		range: function(start, end, step=1) {
			if (!end) {
				end = start;
				start = 0;
			}
			var numbers = [];
			for (var i = start; i < end; i += step) {
				numbers.push(i);
			}
			return numbers;
		},
	},
	computed: {
		
	},
	created: function () {
		
	},
});