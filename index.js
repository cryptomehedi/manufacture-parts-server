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

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jyw9q.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try {
        await client.connect()
        const partsCollection = client.db('manufacture').collection('parts')
        const usersCollection = client.db('manufacture').collection('users')

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

        app.put('/inventory/:id', async (req, res) => {
            // const email=  req.body.userInfo
            // const decodedEmail = req.decoded.email
            // if(email === decodedEmail){
                const id = req.params.id
                console.log(id);
                const filter = {_id : ObjectId(id)}
                const updatedPD = req.body.delivery
                const options = { upsert: true };
                const updateDoc = {
                    $set: updatedPD
                }
                const result = await partsCollection.updateOne(filter, updateDoc, options)
                res.send(result)
            // }else{
            //     res.status(403).send({message: 'forbidden access'})
            // }
            
    })
        
        app.put('/user/:email', async(req, res)=>{
            const email = req.params.email
            const user = req.body
            const filter = {email}
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options)

            const token = jwt.sign({email},process.env.ACCESS_TOKEN_SECRET,{ expiresIn: '7d' })

            res.send({result, token})
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