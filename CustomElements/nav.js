class NavBar extends HTMLElement {
	constructor() {
		super();
	}

	connectedCallback() {
		this.innerHTML = `
		<nav>
			<a href="index.html" id="navHome">Home</a>
			<a href="dictionary.html" id="navDictionary">Dictionary</a>
			<a href="editor.html" id="navEditor">Text Editor</a>
			<a href="symbols.html" id="navSymbols">Symbol Maker</a>
		</nav>
		`;
	}
}

customElements.define('c-nav', NavBar);