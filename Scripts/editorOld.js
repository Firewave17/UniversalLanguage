class Interpreter {
	constructor() {
		this.functionNodes = [];
		this.string = "";
		this.index = 0;

		var letterNode = new FunctionNode("Letter");
		for (var char of "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
			letterNode.addDefinition(char, `return "${char}";`);
		}
		this.functionNodes.push(letterNode);

		var digitNode = new FunctionNode("Digit");
		for (var char of "0123456789") {
			digitNode.addDefinition(char, `return ${+char}`);
		}
		this.functionNodes.push(digitNode);

		var whitespaceNode = new FunctionNode("Whitespace");
		for (var char of " \t\n") {
			whitespaceNode.addDefinition(char, `return "";`);
		}
		// whitespaceNode.addDefinition(`[<Whitespace www>|* WW]`, `return ""`);
		this.functionNodes.push(whitespaceNode);

		var codeNode = new FunctionNode("Code");
		codeNode.addDefinition("<Letter l>", `return l;`);
		codeNode.addDefinition("<Digit d>", `return d;`);
		codeNode.addDefinition("<Whitespace>", `return "";`);
		for (var char of "/'\":;{}+-=_()!@#$%^&*`~.,?") {
			codeNode.addDefinition(char, `return "${char}";`);
		}
		for (var char of "<>[]") {
			codeNode.addDefinition(`\\${char}`, `return "${char}"`);
		}
		this.functionNodes.push(codeNode);

		var wordNode = new FunctionNode("Word");
		wordNode.addDefinition("[<Letter l>|* L]", `
		var string = "";
		var i = 0;
		while (true) {
			var exists = eval(\`typeof l\${i}\`) !== "undefined";
			if (!exists) break;
			string += eval(\`l\${i}\`);
			i++;
		}
		return string;
		`);
		this.functionNodes.push(wordNode);

		var patternPrimNode = new FunctionNode("PatternPrimative");
		// patternPrimNode.addDefinition("<Whitespace>", `return ""`);
		// WORK ON "NOT" CHECKING
		patternPrimNode.addDefinition("<Letter char>", `return char;`);
		patternPrimNode.addDefinition("\\<<Word type> <Word object>\\>", `
			return \`<\${type} \${object}>\`;
		`);
		patternPrimNode.addDefinition("\\<* <Word object>\\>", `
			return \`<* \${object}>\`;
		`);
		patternPrimNode.addDefinition("\\<<Word type>\\>", `
			return \`<\${type}>\`;
		`);
		patternPrimNode.addDefinition("\\[<Pattern p>|* <Word w>\\]", `
			return \`[\${p}|* w]\`;
		`);
		this.functionNodes.push(patternPrimNode);

		var patternNode = new FunctionNode("Pattern");
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
		patternNode.addDefinition(`(<* p>)`, `
			return p;
		`);
		this.functionNodes.push(patternNode);

		var javascriptNode = new FunctionNode("Javascript");
		javascriptNode.addDefinition("[<Code c>|* C]", `
			var string = "";
			var i = 0;
			while (true) {
				var exists = eval(\`typeof c\${i}\`) !== "undefined";
				if (!exists) break;
				string += eval(\`c\${i}\`);
				i++;
			}
			return string;
		`);
		this.functionNodes.push(javascriptNode);

		var defNode = new FunctionNode("Definition");
		defNode.addDefinition(`\\<<* funcname>\\>(<* p>)<Whitespace>${String.fromCodePoint(8912)}<* j>${String.fromCodePoint(8913)}`, `
			var existingNode = interpreter.getNode(funcname);
			if (existingNode) {
				existingNode.addDefinition(p, j);
			} else {
				var node = new FunctionNode(funcname);
				node.addDefinition(p, j);
				interpreter.functionNodes.push(node);
			}
		`);
		this.functionNodes.push(defNode);

		var statementNode = new FunctionNode("Statement");
		statementNode.addDefinition("<Whitespace>", `return`);
		statementNode.addDefinition("<Definition d>", `return d;`);
		this.functionNodes.push(statementNode);
	}
	match(name, pattern, trace=[]) {
		var startIndex = this.index;
		// var i = 0;
		var nodes = {};
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
					// console.log(token.functionName, this.index);
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
							functionNode.definition = new Definition0("", `return \`${string}\``);
							nodes[token.objectName] = functionNode;
						}
					} else if (token.functionName == '~') {
						var string = this.string[this.index];
						// console.log("string:", string);
						this.index++;
						if (token.objectName) {
							var functionNode = new FunctionNode("~");
							functionNode.definition = new Definition0("", `return \`${string}\``);
							nodes[token.objectName] = functionNode;
						}
					} else {
						var functionNode = this.findMatch(token.functionName, trace);
						if (!functionNode) {
							this.index = startIndex;
							return null;
						}
						if (token.objectName) {
							nodes[token.objectName] = functionNode;
						}
					}
					// console.log(functionNode);
					break;
				case "list":
					var elements = [];
					var element;
					var j = 0;
					while (true) {
						j++;
						element = this.match(`${token.functionName}${j}`, token.listPattern, trace);
						if (element) elements.push(element);
						else if (token.listRepeat != '*' && j != +token.listRepeat) {
							this.index = startIndex;
							return null;
						} else break;
					}
					j = 0;
					for (j = 0; j < elements.length; j++) {
						var element = elements[j];
						for (var v of element.getVariables()) {
							eval(`nodes[v + j] = element.${v}`);
						}
					}
					break;
				default:
					console.error("Unknown token type");
					return;
			}
		}
		// while (this.index < this.string.length && i < pattern.length) {
		// 	var char = pattern[i];
		// 	switch(char) {
		// 		case '<':
		// 			i++;
		// 			var end = pattern.indexOf('>', i);
		// 			if (end == -1) {
		// 				console.error("Syntax error: Could not find '>'");
		// 				return;
		// 			}
		// 			var inside = pattern.substr(i, end - i);
		// 			var components = inside.split(" ");
		// 			if (components.length != 1 && components.length != 2) {
		// 				console.error(`Syntax error: found ${components.length} components instead of 2`);
		// 				return;
		// 			}
		// 			var functionName = components[0]; // fix
		// 			if (functionName == '*') {
						
		// 			} else {
		// 				var functionNode = this.findMatch(functionName, trace);
		// 				if (!functionNode) {
		// 					this.index = startIndex;
		// 					return null;
		// 				}
		// 			}
		// 			if (components.length == 2) {
		// 				var objectName = components[1]; // fix
		// 				nodes[objectName] = functionNode;
		// 			}
		// 			i = end + 1;
		// 			break;
		// 		case '\\':
		// 			i++;
		// 			if (pattern[i] == this.string[this.index]) {
		// 				this.index++;
		// 				i++;
		// 			} else {
		// 				this.index = startIndex;
		// 				return null;
		// 			}
		// 			break;
		// 		case '[':
		// 			i++;
		// 			var end = pattern.indexOf(']', i);
		// 			if (end == -1) {
		// 				console.error("Syntax error: Could not find '>'");
		// 				return;
		// 			}
		// 			var inside = pattern.substr(i, end - i);
		// 			var components = inside.split('|');
		// 			if (components.length != 2) {
		// 				console.error(`Syntax error: found ${components.length} components instead of 2`);
		// 				return;
		// 			}
		// 			var rightComponents = components[1].split(" ");
		// 			var num = rightComponents[0];
		// 			var functionName = rightComponents[1]; // fix
		// 			var elements = [];
		// 			if (num == '*') {
		// 				var element;
		// 				var j = 0;
		// 				while (true) {
		// 					element = this.match(`${functionName}${j}`, components[0], trace);
		// 					if (element) elements.push(element);
		// 					else break;
		// 					j++;
		// 				}
		// 			} else {
		// 				if (+num) {
		// 					num = +num;
		// 				} else {
		// 					console.error(`Syntax error: ${num} not a number or *`);
		// 				}
		// 				for (var j = 0; j < num; j++) {
		// 					let element = this.match(`${functionName}${j}`, components[0], trace);
		// 					if (element) elements.push(element);
		// 					else {
		// 						this.index = startIndex;
		// 						return null;
		// 					}
		// 				}
		// 			}
		// 			var j = 0;
		// 			for (var element of elements) {
		// 				for (var v of element.getVariables()) {
		// 					eval(`nodes[v + j] = element.${v}`);
		// 				}
		// 				j++;
		// 			}
		// 			i = end + 1;
		// 			break;
		// 		default:
		// 			if (pattern[i] == this.string[this.index]) {
		// 				this.index++;
		// 				i++;
		// 			} else {
		// 				this.index = startIndex;
		// 				return null;
		// 			}
		// 			break;
		// 	}
		// }
		return new FunctionNode(name, nodes);
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
		for (var definition of node.definitions) {
			if (trace.includes(definition)) continue;
			var n = this.match(name, definition.pattern, trace.concat(definition));
			if (n) {
				n.definition = definition;
				return n;
			}
		}
		return null;
	}
	interpret(node) {
		var variables = Object.getOwnPropertyNames(node);
		if (!variables.includes("definition")) {
			console.error(`Unknown definition for ${node}`);
			return;
		}
		var names = [];
		var values = [];
		for (var v of variables) {
			if (["name", "definitions", "definition"].includes(v)) continue;
			names.push(v);
			values.push(new Function(`interpreter`, `node`, `return interpreter.interpret(node.${v})`)(this, node));
		}
		return new Function(`interpreter`, ...names, node.definition.interpretation)(this, ...values);
	}
	run(string) {
		this.string = string;
		this.index = 0;

		var statement;
		while (true) {
			statement = this.findMatch("Statement");
			if (!statement) break;
			// console.log(statement);
			this.interpret(statement);
		}
	}
	// interpret(node) {
	// 	for (var possibility of this.possibilities) {
	// 		if (this.peek(possibility.regex)) {
	// 			return this.match(possibility.regex);
	// 		}
	// 	}
	// 	console.error(`Node ${this.name} could not find a match,
	// 	expected one of ${this.possibilities.map((possibility) => {
	// 		return possibility.regex;
	// 	})}`);
	// }
}

class Token {
	constructor() {
		this.tokenType;
		this.pattern;
	}
	static tokenizePattern(pattern) {
		// console.log(pattern);
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
					// token.char = pattern[i];
					i++;
					break;
			}
			tokens.push(token);
		}
		return tokens;
	}
}


class FunctionNode {
	constructor(name, dependencies={}) {
		this.name = name;
		this.definitions = [];
		this.definition = null;
		for (var d of Object.keys(dependencies)) {
			eval(`this.${d} = dependencies[d];`);
		}
	}
	addDefinition(pattern, interpretation) {
		this.definitions.unshift(new Definition0(pattern, interpretation));
	}
	getDefinition(pattern) {
		for (var d of this.definitions) {
			if (d.pattern == pattern) return d.definition;
		}
		return null;
	}
	getVariables() {
		var properties = Object.getOwnPropertyNames(this);
		var variables = []
		for (var v of properties) {
			if (["name", "definitions", "definition"].includes(v)) continue;
			variables.push(v);
		}
		return variables;
	}
	// interpret() {
	// 	for (var pattern of this.patterns) {
	// 		if (this.peek(pattern.regex)) {
	// 			return this.match(pattern.regex);
	// 		}
	// 	}
	// 	console.error(`Node ${this.name} could not find a match,
	// 	expected one of ${this.possibilities.map((possibility) => {
	// 		return possibility.regex;
	// 	})}`);
	// }
}

class Definition0 {
	constructor(pattern, interpretation) {
		this.pattern = pattern;
		this.interpretation = interpretation;
	}
}










class Word {
	constructor(string, definition="", dialect=null) {
		this.string = string;
		this.setDefinition(definition);
		this.dialect = dialect;
	}
	// string() {
	// 	return String.fromCodePoint(this.charCode);
	// }
	setDefinition(string) {
		var definition = Dictionary.findDefinition(string);
		if (!definition) {
			definition = new Definition(string);
			Dictionary.definitions.push(definition);
		}
		if (definition.symbols.includes(this.string)) return;
		this.definition = definition;
		definition.symbols.push(this.string);
	}
	static wordsToString(words) {
		var string = "";
		for (var word of words) {
			string += word.string;
		}
		return string;
	}
}
class Definition {
	constructor(executable) {
		this.symbols = [];
		this.executable = executable;
	}
}

class Node {
	constructor(value=null) {
		this.value = value;
		this.nodes = {};
	}
}
class Dictionary {
	static definitions = [];
	constructor() {
		this.root = new Node();
	}
	defineSymbol(string, definitionString, dialect) {
		var node = this.root;
		var word = "";
		for (var char of string) {
			word += char;
			if (char in node.nodes) {
				node = node.nodes[char];
			}
			else {
				node.nodes[char] = new Node();
				node = node.nodes[char];
			}
		}
		node.value = new Word(word, definitionString, dialect);
	}
	readSymbolsR(string, node, word, words) {
		for (let i = 0; i < string.length; i++) {
			let char = string[i];
			if (char in node.nodes) {
				word += char;
			} else {
				words.push(word);
				word = "";
				this.readSymbolsR(string.splice(i), node.nodes[char], word, words);
				break;
			}
		}
		return words;
	}
	readSymbols(string) {
		return this.readSymbolsR(string, this.root, []);
	}
	getSymbolsR(node, words) {
		if (node.value) {
			words.push(node.value);
		}
		for (var char of Object.keys(node.nodes)) {
			this.getSymbolsR(node.nodes[char], words);
		}
		return words;
	}
	getSymbols() {
		return this.getSymbolsR(this.root, []);
	}
	checkSymbol(string) {
		var node = this.root;
		while (string) {
			var char = string[0];
			if (char in node.nodes) {
				node = node.nodes[char];
				string = string.slice(1);
			} else return "error";
		}
		if (node.value) return node.value;
		return null;
	}
	findSymbolR(node, lexeme, remaining, output) {
		if (!remaining) {
			if (lexeme != "" && this.checkSymbol(lexeme)) {
				output.push(this.checkSymbol(lexeme));
			}
			return output;
		}
		var char = remaining[0];
		if (!(char in node.nodes)) {
			if (node == this.root) {
				return this.findSymbolR(this.root, lexeme, remaining.slice(1), output);
			}
			if (this.checkSymbol(lexeme)) {
				output.push(this.checkSymbol(lexeme));
			}
			return this.findSymbolR(this.root, "", remaining, output);
		} else {
			return this.findSymbolR(node.nodes[char], lexeme + char, remaining.slice(1), output);
		}
	}
	findSymbol(string) {
		return this.findSymbolR(this.root, "", string, []);
	}
	print() {
		var words = this.getSymbols();
		for (let word of words) {
			console.log(word);
		}
	}
	symbolsToString(symbols) {
		var string = "";
		for (let symbol of symbols) {
			string += symbol.definition.executable;
		}
		return string;
	}
	static findDefinition(string) {
		for (let definition of Dictionary.definitions) {
			if (definition.executable == string) return definition;
		}
		return null;
	}
}

var app = new Vue({
	el: "#app",
	data: {
		dictionary: new Dictionary(),
		interpreter: new Interpreter(),
		textInput: `<Statement>(${String.fromCodePoint(128489)}<Word w>)
${String.fromCodePoint(8912)}
	console.log(w)
${String.fromCodePoint(8913)}
${String.fromCodePoint(128489)}and`,
		textOutput: "",
		inputTranslationLanguage: "",
		compilerOutput: "",
	},
	methods: {
		readString: function() {
			this.dictionary.findSymbol(this.textInput);
		},
		runCode: function () {
			// this.compilerOutput = eval(this.textOutput);
			this.interpreter.run(this.textInput);
		},
		tabPressed: function(e) {
			e.preventDefault();
			var textarea = e.target;
			textarea.setRangeText("\t", textarea.selectionStart, textarea.selectionStart, "end");
		},
		translate: function() {
			var symbols = this.dictionary.findSymbol(this.textInput);
			var newSymbols = [];
			for (let symbol of symbols) {
				var flag = false;
				for (let sString of symbol.definition.symbols) {
					var s = this.dictionary.findSymbol(sString)[0];
					if (s.dialect == this.inputTranslationLanguage) {
						flag = true;
						newSymbols.push(s);
						break;
						// AMBIGUITY POSSIBLE
					}
				}
				if (!flag) {
					newSymbols.push(symbol);
				}
			}
			this.textInput = Word.wordsToString(newSymbols);
			// this.textInput = this.dictionary.symbolsToString(newSymbols);
		},
	},
	computed: {
		// textOutput: function() {
		// 	// return `${this.dictionary.symbolsToString(this.dictionary.findSymbol(this.textInput))}`;
		// },
	},
	created: function () {
		const E = "English";
		this.dictionary.defineSymbol("if", "if", E);
		this.dictionary.defineSymbol("is", "==", E);
		this.dictionary.defineSymbol("isn't", "!=", E);
		this.dictionary.defineSymbol("uv", "(", E);
		this.dictionary.defineSymbol("vu", ")", E);
		this.dictionary.defineSymbol(".", ";", E);
		this.dictionary.defineSymbol("speak", `console.log("hi")`, E);
		this.dictionary.defineSymbol("zero", "0", E);
		this.dictionary.defineSymbol("one", "1", E);
		this.dictionary.defineSymbol("begin", "{", E);
		this.dictionary.defineSymbol("end", "}", E);
		this.dictionary.defineSymbol("is function", "=>", E);
		
		const T = "Thingy";
		this.dictionary.defineSymbol(String.fromCharCode(9788), "if", T);
		this.dictionary.defineSymbol("=", "==", T);
		this.dictionary.defineSymbol(String.fromCharCode(172), "!=", T);
		this.dictionary.defineSymbol(String.fromCharCode(8992), "(", T);
		this.dictionary.defineSymbol(String.fromCharCode(8993), ")", T);
		this.dictionary.defineSymbol(String.fromCharCode(9608), ";", T);
		this.dictionary.defineSymbol(String.fromCharCode(9835), `console.log("hi")`, T);
		this.dictionary.defineSymbol(String.fromCharCode(9675), "0", T);
		this.dictionary.defineSymbol(String.fromCharCode(8226), "1", T);
		this.dictionary.defineSymbol(String.fromCharCode(10094), "{", T);
		this.dictionary.defineSymbol(String.fromCharCode(10095), "}", T);
		this.dictionary.defineSymbol(String.fromCharCode(8669), "=>", T);

		//Small
		const S = "Small";
		this.dictionary.defineSymbol("<<", "(", S);
		this.dictionary.defineSymbol(">>", ")", S);
		
		// Javascript
		const J = "Javascript";
		for (var char of [
			"\n", " ", "\r", "\t",
			"(", ")", "{", "}", "[", "]",
			"=", "==", "!=", ";", "+", "-", "*", "/",
			"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
		]) {
			this.dictionary.defineSymbol(char, char, J);
		}
	},
});