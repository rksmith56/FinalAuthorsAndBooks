const http = require('http');
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, 'credentialsDontPost/.env')});

const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const databaseName = process.env.MONGO_DB_NAME;
const collectionName = process.env.MONGO_COLLECTION;

// MongoDB setup

const databaseAndCollection = {db: databaseName, collection: collectionName};

const { MongoClient, ServerApiVersion } = require('mongodb');
const { clear } = require('console');
const { setEnvironmentData } = require('worker_threads');
async function insertAuthorsBooks(author) {
    const uri = `mongodb+srv://${userName}:${password}@cluster0.zbxksyh.mongodb.net/?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    try {
        await client.connect().then(insertAuthorsBooksHelper(client, databaseAndCollection, author))
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function insertAuthorsBooksHelper(client, databaseAndCollection, newAuthor) {
    fetch(`http://openlibrary.org/search.json?q=${newAuthor}`).then(response => response.json()).then(async data => {
        console.log(data.docs)
        sortedDocs = data.docs.filter(function( obj ) {
            if (obj === undefined || obj.author_name === undefined || obj.edition_count === undefined) {
                return false;
            } else if ((obj.author_name.indexOf(`${newAuthor}`) !== -1) && (obj.edition_count > 1)) {
                return true;
            }
        });
        await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertMany(sortedDocs)
    })
}

async function lookUpAllBooks(gpa) {
    const uri = `mongodb+srv://${userName}:${password}@cluster0.zbxksyh.mongodb.net/?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    try {
        await client.connect();
            let result = await lookUpAllBooksHelper(client, databaseAndCollection, 1);
            return result;
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function lookUpAllBooksHelper(client, databaseAndCollection, edition_count) {
    let filter = {edition_count : { $gte: edition_count}};
    const cursor = client.db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .find(filter);

    if (cursor) {
        const result = await cursor.toArray();
        return result;
    } else {
        console.log(`No movie found`);
    }
}

async function lookUpAuthorsByCriteria(numEditions, firstPublishYear) {
    const uri = `mongodb+srv://${userName}:${password}@cluster0.zbxksyh.mongodb.net/?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    try {
        await client.connect();
            let result = await lookUpAuthorsByCriteriaHelper(client, databaseAndCollection, numEditions, firstPublishYear);
            return result;
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function lookUpAuthorsByCriteriaHelper(client, databaseAndCollection, edition_count, first_publish_year) {
    let filter = {edition_count : { $gte: edition_count}, first_publish_year : { $gte: first_publish_year}};
    const cursor = client.db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .find(filter);

    if (cursor) {
        const result = await cursor.toArray();
        return result;
    } else {
        console.log(`No movie found`);
    }
}

async function clearCollection() {
    const uri = `mongodb+srv://${userName}:${password}@cluster0.zbxksyh.mongodb.net/?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

    try {
        await client.connect();
        const result = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .deleteMany({});
        return result.deletedCount;
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

// Port Numbers
app.listen(3000);
process.stdin.setEncoding("utf8");

// Webpage Setup
app.use(bodyParser.urlencoded({extended:false}));
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.get("/", (request, response) => {
    response.render("homePage");
});

app.get("/apply", (request, response) => {
    response.render("application");
});

app.post("/apply", (request, response) => {
    let  {authors} = request.body;
    insertAuthorsBooks(authors);
    const variables = {
        authorName: authors,
    }
    response.render("processApplication", variables);
});

app.get("/reviewApplication", (request, response) => {
    response.render("reviewApplication");
});

app.post("/reviewApplication", async (request, response) => {
    await lookUpAllBooks().then(result => {  
        var table = "<table border='1'>";
        table += `<tr><th>Title</td><th>Author</td></tr>`;
        result.forEach((item) => {
            table += `<tr><td>${item.title}</td><td>${item.author_name[0]}</td></tr>`;
        })
        table += "</table>";

        const variables = {
            authorTable: table
        }
        response.render("processReviewAllBooks", variables);
    })
});

app.get("/adminGFA", (request, response) => {
    response.render("adminGFA");
});

app.post("/adminGFA", async (request, response) => {
    let {numEditions, firstPublishYear} = request.body;
    await lookUpAuthorsByCriteria(Number(numEditions), Number(firstPublishYear)).then(result => {  
        var table = "<table border='1'>";
        table += `<tr><th>Title</td><th>Author</td><th>Number of Editions</td><th>First Publish Year</td></tr>`;
        result.forEach((item) => {
            console.log(item)
            table += `<tr><td>${item.title}</td><td>${item.author_name[0]}</td><td>${item.edition_count}</td><td>${item.first_publish_year}</td></tr>`;
        })
        table += "</table>";

        const variables = {
            authorTable: table,
            numBooks : result.length
        }
        response.render("processAdminGFA", variables);
    })
});

app.get("/adminRemove", (request, response) => {
    response.render("adminRemove");
});

app.post("/adminRemove", async (request, response) => {
    await clearCollection().then(result => {
        const variables = {
            numRemoved: result
        }
        response.render("processAdminRemove", variables);
    })
});

// Command Line Interpreter
const prompt = 'Stop to shutdown the server: ';
process.stdout.write(prompt);

process.stdin.on('readable', () => {
    let dataInput = process.stdin.read();
    if (dataInput !== null) {
        let command = dataInput.trim();
        if (command === "stop") {
            console.log("Shutting down the server");
            process.exit(0);
        }
        process.stdout.write(prompt);
        process.stdin.resume();
    } 
})