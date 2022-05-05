const PORT = 3333;

const express = require("express");
const cors = require("cors");

const model = require("./model");
const Program = model.Program;

const app = express();

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.get("/programs/:name", (req, res) => {
	var query = {name: req.params.name };
	var sort = {};
	Program.find(query).sort(sort).then((programs) => {
		res.json(programs);
	});
});

app.post("/programs", (req, res) => {
	const program = new Program({
		name: req.body.name,
		text: req.body.text,
	});
	program.save().then(() => {
		res.status(201).send("Created");
	}).catch(() => {
		res.status(500).send("Server error");
	});
});

app.put("/programs/:id", (req, res) => {
	Program.findOne({
		_id: req.params.id,
	}).then((program) => {
		if (program) {
			program.name = req.body.name;
			program.text = req.body.text;
			program.save().then(() => {
				console.log(`Updated ${program.name}`);
				res.status(204).send(`Updated ${program.name}`);
			}).catch((error) => {
				if (error.errors) {
					let errorMessages = {};
					for (let e in error.errors) {
						errorMessages[e] = error.errors[e].message;
					}
					res.status(422).send(errorMessages);
				}
				else {
					res.status(500).send("Server error");
				}
			});
		} else {
			res.sendStatus(404);
		}
	}).catch((error) => {
		res.sendStatus(400);
	});
});

app.delete("/programs/:id", (req, res) => {
	Program.findOne({
		_id: req.params.id,
	}).then((program) => {
		if (program) {
			program.deleteOne({
				_id: req.params.id
			}).then(() => {
				res.status(204).send("Deleted");
			}).catch((error) => {
				if (error.errors) {
					let errorMessages = {};
					for (let e in error.errors) {
						errorMessages[e] = error.errors[e].message;
					}
					res.status(422).send(errorMessages);
				}
				else {
					res.status(500).send("Server error");
				}
			})
		} else {
			res.sendStatus(404);
		}
	}).catch((error) => {
		console.error("DB failed", error);
		res.sendStatus(400);
	});
});

app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}...`);
});