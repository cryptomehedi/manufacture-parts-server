const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 4000
require('dotenv').config();


// mid ware
app.use(cors())
app.use(express.json())

// mongodb connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.BD_PASS}@cluster0.jyw9q.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try {
        await client.connect()
        const partsCollection = client.db('manufacture').collection('parts')

        app.get('/allParts', async (req, res) =>{
            const query = {}
            const cursor = partsCollection.find(query)
            const service = await cursor.toArray()
            res.send(service)
        })

        // pagenation 

        app.get('/pagesParts',async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);

            const query = {};
            const cursor = partsCollection.find(query);
            let products;
            if(page || size){

                products = await cursor.skip(page*size).limit(size).toArray()
            }else{
                products = await cursor.toArray()
            }
            
            res.send(products)
        })
        

        app.get('/allPartsCount', async (req, res) => {
            const count = await partsCollection.estimatedDocumentCount()
            res.send({count})
        })

        app.get('/inventory/:id', async (req, res) =>{
            const id = req.params.id
            const query = {_id: ObjectId(id)}
            const service = await partsCollection.findOne(query)
            res.send(service)
        })
        
    }
    finally{
        
    }
}
run().catch(console.dir)




app.get('/', (req, res) => {
    res.send('Server running Successfully')
})

app.listen(port, ()=> {
    console.log(port);
})