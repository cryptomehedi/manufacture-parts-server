const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 4000
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// mid ware
const corsOptions ={
    origin:'http://localhost:3000' || 'https://manufacture-parts-production.up.railway.app', 
    credentials:true,            //access-control-allow-credentials:true
    optionSuccessStatus:200
}

app.use(cors(corsOptions))
app.use(express.json())

// mongodb connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jyw9q.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyToken(req, res, next) {
    const authorization = req.headers.authorization
    if(!authorization){
        return res.status(401).send({ message: 'Invalid Authorization'})
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err, decoded)=>{
        if(err){
            return res.status(403).send({ message: 'Invalid Access Token' })
        }
        req.decoded = decoded
        next()
    })
}

async function run(){
    try {
        await client.connect()
        const partsCollection = client.db('manufacture').collection('parts')
        const usersCollection = client.db('manufacture').collection('users')
        const ordersCollection = client.db('manufacture').collection('orders')
        const reviewsCollection = client.db('manufacture').collection('reviews')
        const paymentsCollection = client.db('manufacture').collection('payments')


        app.post('/create-payment-intent',async (req, res)=>{
            const service = req.body
            console.log(service);
            const price = service.totalPrice
            const amount = price * 100
            console.log(amount);
            const paymentIntent = await stripe.paymentIntents.create({
                amount : amount,
                currency : 'USD',
                payment_method_types: ['card']
            })
            res.send({ clientSecret: paymentIntent.client_secret, })
        })



        const verifyAdmin = async(req, res,next)=>{
            const requester = req.decoded.email
            const requesterAccount = await usersCollection.findOne({email: requester})
            if(requesterAccount.role === 'admin'){
                next()
            }else{
                res.status(403).send({ message: 'Invalid Access' })
            }
        }



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

        app.put('/inventory/:id',verifyToken, async (req, res) => {
            const email=  req.body.userInfo
            const decodedEmail = req.decoded.email
            if(email === decodedEmail){
                const id = req.params.id
                const filter = {_id : ObjectId(id)}
                const updatedPD = req.body.restAvailable || req.body.newAvailable
                console.log(updatedPD);
                const options = { upsert: true };
                const updateDoc = {
                    $set: updatedPD
                }
                const result = await partsCollection.updateOne(filter, updateDoc, options)
                res.send(result)
            }else{
                res.status(403).send({message: 'forbidden access'})
            }
        })

        app.post('/inventory',verifyToken, async(req, res) => {
            const email=  req.body.userInfo
            const decodedEmail = req.decoded.email
            if(email === decodedEmail){
                const userOrder = req.body.orderItem
                console.log('adding new order', userOrder )
                const result = await ordersCollection.insertOne(userOrder)
                res.send(result)
            }else{
                res.status(403).send({message: 'forbidden access'})
            }
        })
        
        app.put('/user/:email', async(req, res)=>{
            const email = req.params.email
            console.log(email);
            const user = req.body
            const filter = {email}
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options)

            const token = jwt.sign({email},process.env.ACCESS_TOKEN_SECRET,{ expiresIn: '1d' })

            res.send({result, token})
        })

        app.get('/user/:email', async(req, res)=>{
            const email = req.params.email
            const user = await usersCollection.findOne({email})
            res.send(user)
        })

        app.get('/user',verifyToken, verifyAdmin, async(req, res)=>{
            const user = await usersCollection.find().toArray()
            res.send(user)
        })

        app.put('/users/:email', verifyToken, async(req, res)=>{
            const email = req.params.email
            const user = req.body
            console.log(user)
            const filter = {email}
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.send(result);
        })

        app.put('/user/admin/:email',verifyToken,verifyAdmin, async(req, res)=>{
            const email = req.params.email
            const role = req.body
            console.log(role)
                const filter = {email}
                const updateDoc = {
                    $set: role,
                };
                const result = await usersCollection.updateOne(filter, updateDoc)
                return res.send({result})
            
        })
        app.get('/admin/:email', async(req, res)=>{
            const email = req.params.email
            const user = await usersCollection.findOne({email})
            const isAdmin = user.role === 'admin'
            res.send(isAdmin)
        })

        app.get('/order', verifyToken, async (req, res) => {
            const email = req.query.customer
            const decodedEmail = req.decoded.email
            if(decodedEmail === email) {
                const query = {email}
                console.log(query);

                const myOrder = await ordersCollection.find(query).toArray()
                return res.send(myOrder)
            }
            else{
                return res.status(403).send({ message: 'Invalid Access' })
            }
        })

        app.put('/order/:id',verifyToken, async(req, res) => {
            const id = req.params.id
            const payment = req.body
            const filter = {_id: ObjectId(id)} 
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    paid : true,
                    transactionId: payment.transactionId
                },
            };
            const result = await paymentsCollection.insertOne(payment)
            const updatedOrder = await ordersCollection.updateOne(filter,updateDoc, options )
            // res.send({updatedBooking, result})
            res.send(updateDoc)
        })

        app.put('/orderShipped/:id',verifyToken, async(req, res) => {
            const id = req.params.id
            const filter = {_id: ObjectId(id)} 
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    shipped : true,
                },
            };
            const updatedOrder = await ordersCollection.updateOne(filter,updateDoc, options )
            res.send(updatedOrder)
        })

        app.get('/allOrder',verifyToken, verifyAdmin,async (req, res) =>{
            const query = {}
            const allOrder = await ordersCollection.find(query).toArray()
            res.send(allOrder)
        })

        app.post('/parts', verifyToken, async(req, res) => {
            const parts = req.body
            const result = await partsCollection.insertOne(parts)
            res.send(result)
        })

        app.post('/reviews',verifyToken, async(req, res) => {
            const review = req.body
            console.log(review);
            const result = await reviewsCollection.insertOne(review)
            res.send(result)
        })

        app.get('/reviews', async (req, res) =>{
            const query = {}
            const result = await reviewsCollection.find(query).toArray()
            res.send(result)
        })


        app.get('/order/:id',verifyToken, async (req, res) => {
            const id =req.params.id
            const filter ={_id: ObjectId(id)}
            console.log(filter)
            const result = await ordersCollection.findOne(filter)
            res.send(result)
        })
        app.delete('/order/:id',verifyToken, async (req, res) => {
            const id =req.params.id
            const filter ={_id: ObjectId(id)}
            console.log(filter)
            const result = await ordersCollection.deleteOne(filter)
            res.send(result)
        })

        app.delete('/parts/:id',verifyToken,verifyAdmin, async (req, res) => {
            const id =req.params.id
            const filter ={_id: ObjectId(id)}
            console.log(filter)
            const result = await partsCollection.deleteOne(filter)
            res.send(result)
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