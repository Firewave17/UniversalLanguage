const mongoose = require("mongoose");
mongoose.connect(`mongodb+srv://Hexagon:r1VChSPXrGLn1TeC@dictionary.dgx6d.mongodb.net/programs?retryWrites=true&w=majority`);

const programSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		unique: true,
	},
	text: {
		type: String,
		required: true,
	},
});
const Program = mongoose.model("Program", programSchema);

module.exports = {
	Program: Program,
};