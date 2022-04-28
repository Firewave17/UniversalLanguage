const express = require("express");
const cors = require("cors");
const model = require("./model");

const app = express();

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());