import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { comparePassword, hashPassword } from './libs/bcrypt';
import { builder } from './types/builder';
import * as fs from 'fs';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { authWare } from './middlewares/auth';

const serviceAccount = JSON.parse(
  fs.readFileSync('./services-account.json', 'utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestoreDB = admin.firestore();
const app = express();

app.use(cors({ origin: true }));

dotenv.config();

// Routes
// Home
app.get('/', (req, res) => {
  return res.status(200).send('Welcome to Ethlas Builder!');
});

// Create Builder
app.post('/builders/create', (req, res) => {
  (async () => {
    try {
      const uuid = uuidv4();
      const builder: builder = {
        uuid: uuid,
        email: req.body.email,
        full_name: req.body.full_name,
        join_date: Date.now(),
        password: await hashPassword(req.body.password),
      };

      await firestoreDB.collection('builders').doc(`/${uuid}`).create(builder);

      return res.status(200).send({ status: true, msg: 'Create successed.' });
    } catch (error) {
      console.log(error);

      return res.status(500).send({ status: false, msg: 'Create failed.' });
    }
  })();
});

// Login by Email & Password
app.post('/builders/login', (req, res) => {
  (async () => {
    try {
      const reqDoc = firestoreDB
        .collection('builders')
        .where('email', '==', req.body.email)
        .limit(1);
      let builderHashPassword = '';

      await reqDoc.get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          builderHashPassword = doc.data()!.password;
        });
      });

      const isPasswordValid = await comparePassword(
        req.body.password,
        builderHashPassword
      );

      const jwtToken: string = process.env.JWT_TOKEN_KEY;
      if (isPasswordValid) {
        const token = jwt.sign(req.body.email, jwtToken);

        return res.status(200).send({ status: true, data: token });
      }

      return res.status(401).send({ status: false, msg: 'Not authorized.' });
    } catch (error) {
      console.log(error);

      return res.status(500).send({ status: false, msg: error });
    }
  })();
});

// Get Builder by UUID
app.get('/builders/:uuid', (req, res) => {
  (async () => {
    try {
      const reqDoc = firestoreDB.collection('builders').doc(req.params.uuid);
      const getDoc = await reqDoc.get();
      const doc = getDoc.data();
      const builder: builder = {
        uuid: doc!.uuid,
        email: doc!.email,
        full_name: doc!.full_name,
        join_date: doc!.join_date,
      };

      return res.status(200).send({ status: true, data: builder });
    } catch (error) {
      console.log(error);

      return res.status(500).send({ status: false, msg: error });
    }
  })();
});

// Get All Builders
app.get('/builders', (req, res) => {
  (async () => {
    try {
      const reqCollection = firestoreDB
        .collection('builders')
        .limit(10)
        .orderBy('join_date', 'desc');
      const responses: any = [];

      await reqCollection.get().then((data) => {
        const docs = data.docs;

        docs.map((doc) => {
          const builder: builder = {
            uuid: doc.data().uuid,
            email: doc.data().email,
            full_name: doc.data().full_name,
            join_date: doc.data().join_date,
          };

          responses.push(builder);
        });

        return responses;
      });

      return res.status(200).send({ status: true, data: responses });
    } catch (error) {
      console.log(error);

      return res
        .status(500)
        .send({ status: false, msg: 'Get Builders data failed.' });
    }
  })();
});

// Update Builder
app.put('/builders/update/:uuid', authWare, (req, res) => {
  (async () => {
    try {
      const reqDoc = firestoreDB.collection('builders').doc(req.params.uuid);
      const builder = (await reqDoc.get()).data();

      if (builder!.email != req.jwtPayload) {
        return res.status(401).send({ status: false, msg: 'Not authorized.' });
      }

      const builderUpdate: builder = {
        full_name: req.body.full_name ?? builder!.full_name,
        password: req.body.password
          ? await hashPassword(req.body.password)
          : builder!.password,
      };

      await reqDoc.update(builderUpdate);

      return res.status(200).send({ status: true, msg: 'Update successed.' });
    } catch (error) {
      console.log(error);

      return res.status(500).send({ status: false, msg: 'Update failed.' });
    }
  })();
});

// Delete Builder
app.delete('/builders/delete/:uuid', authWare, (req, res) => {
  (async () => {
    try {
      const reqDoc = firestoreDB.collection('builders').doc(req.params.uuid);
      const builderEmail = (await reqDoc.get()).data()!.email;

      if (builderEmail != req.jwtPayload) {
        return res.status(401).send({ status: false, msg: 'Not authorized.' });
      }

      await reqDoc.delete();

      return res.status(200).send({ status: true, msg: 'Delete successed.' });
    } catch (error) {
      console.log(error);

      return res.status(500).send({ status: false, msg: 'Delete failed.' });
    }
  })();
});

exports.app = functions.https.onRequest(app);
