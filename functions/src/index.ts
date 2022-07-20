import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import { comparePassword, hashPassword, humanDate } from './libs/helpers';
import { builder } from './types/builder';
import * as fs from 'fs';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { auth } from './middlewares/auth';
// import * as multer from 'multer';
// import * as bodyParser from 'body-parser';

const serviceAccount = JSON.parse(
  fs.readFileSync('./service-account.json', 'utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestoreDB = admin.firestore();
const app = express();

app.use(cors({ origin: true }));
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.static('public'));

dotenv.config();

// Routes
// Home
app.get('/', (req, res) => {
  // Send response to client
  res.status(200).send('Welcome to Ethlas Builder!');
});

// Register builder
app.post('/register', (req, res) => {
  (async () => {
    try {
      // Set builder data
      const builder: builder = {
        email: req.body.email,
        full_name: req.body.full_name,
        join_date: Date.now(),
        password: await hashPassword(req.body.password),
      };

      // Push the new builder into firestore
      const newBuilder = await firestoreDB.collection('builders').add(builder);
      if (!newBuilder) {
        // Send log
        console.log('Register builder failed');

        // Send response to client
        res
          .status(500)
          .send({ status: false, message: 'Register builder failed' });
      }

      const jwtToken: string = process.env.JWT_TOKEN_KEY;
      const token = jwt.sign(req.body.email, jwtToken);
      builder.id = newBuilder.id;
      builder.join_date_human = humanDate(builder?.join_date);
      builder.token = token;
      builder.join_date = undefined;
      builder.password = undefined;

      // Send response to client
      res.status(200).send({
        status: true,
        data: builder,
        message: `Register successed. Builder id: ${newBuilder.id}`,
      });
    } catch (error) {
      // Send log
      console.log(error);

      // Send response to client
      res
        .status(500)
        .send({ status: false, message: 'Register builder failed' });
    }
  })();
});

// Login Builder by email and password
app.post('/login', (req, res) => {
  (async () => {
    try {
      // Get builder by email
      const getBuilder = firestoreDB
        .collection('builders')
        .where('email', '==', req.body.email)
        .limit(1)
        .get();

      // Check Builder exists
      if ((await getBuilder).empty) {
        // Send response to client
        res.status(401).send({ status: false, message: 'Email not found' });
      }

      // Get builder data
      const getBuilderDoc = (await getBuilder).docs.at(0);
      const getBuilderData = getBuilderDoc!.data();

      // Get builder hashed password
      let builderHashPassword = getBuilderData!.password;

      // Compare password
      const isPasswordValid = await comparePassword(
        req.body.password,
        builderHashPassword
      );

      // Check password
      if (!isPasswordValid) {
        // Send response to client
        res.status(401).send({ status: false, message: 'Password not valid' });
      }

      // Generate JWT Token.
      const jwtToken: string = process.env.JWT_TOKEN_KEY;
      const token = jwt.sign(req.body.email, jwtToken);

      const builder: builder = {
        id: getBuilderDoc!.id,
        full_name: getBuilderData.full_name,
        email: getBuilderData.email,
        join_date_human: humanDate(getBuilderData.join_date),
        token: token,
      };

      // Send response to client
      res.status(200).send({ status: true, data: builder });
    } catch (error) {
      // Send log
      console.log(error);

      // Send response to client
      res.status(500).send({ status: false, message: 'Login failed' });
    }
  })();
});

// Get builder profile by id
app.get('/profile/:id', (req, res) => {
  (async () => {
    try {
      // Get builder by id
      const getBuilder = await firestoreDB
        .collection('builders')
        .doc(req.params.id)
        .get();

      // Check builder exists
      if (!getBuilder.exists) {
        // Send response to client
        res
          .status(401)
          .send({ status: false, message: 'Builder id not found' });
      }

      // Set data builder
      const builderData = getBuilder.data();
      const builder: builder = {
        id: getBuilder.id,
        email: builderData!.email,
        full_name: builderData!.full_name,
        join_date_human: humanDate(builderData!.join_date),
      };

      // Send response to client
      res.status(200).send({ status: true, data: builder });
    } catch (error) {
      // Send log
      console.log(error);

      // Send response to client
      res
        .status(500)
        .send({ status: false, message: 'Get builder profile failed' });
    }
  })();
});

// Get latest 10 builders
app.get('/list', (req, res) => {
  (async () => {
    try {
      // Get List Builder limit 10 latest order
      const getListBuilder = firestoreDB
        .collection('builders')
        .limit(10)
        .orderBy('join_date', 'desc')
        .get();

      // Set list data builder
      const listBuilder: builder[] = [];
      await getListBuilder.then((data) => {
        const docs = data.docs;
        docs.map((doc) => {
          const builder: builder = {
            id: doc.id,
            email: doc.data().email,
            full_name: doc.data().full_name,
            join_date_human: humanDate(doc.data().join_date),
          };

          listBuilder.push(builder);
        });

        listBuilder;
      });

      // Send response to client
      res.status(200).send({ status: true, data: listBuilder });
    } catch (error) {
      // Send log
      console.log(error);

      // Send response to client
      res
        .status(500)
        .send({ status: false, message: 'Get latets 10 builders failed' });
    }
  })();
});

// Update builder
app.post(
  '/update/:id',
  [auth /*, multer().single('file_photo')*/],
  (req: any, res: any) => {
    (async () => {
      try {
        // console.log(req.body);
        // console.log(req.file);
        // res.status(401).send({
        //   status: false,
        //   data: req.body,
        //   message: 'Current Password can`t be empty',
        // });
        // Check password
        if (!req.body.current_password) {
          // Send response to client
          res.status(401).send({
            status: false,
            message: 'Current Password can`t be empty',
          });
        }

        if (
          (req.body.password || req.body.confirm_password) &&
          req.body.password != req.body.confirm_password
        ) {
          // Send response to client
          res.status(401).send({
            status: false,
            message: 'Password and Confirm Password not same',
          });
        }

        // Get builder by id
        const docBuilder = firestoreDB
          .collection('builders')
          .doc(req.params.id);
        const getBuilder = await docBuilder.get();

        // Check builder exists
        if (!getBuilder.exists) {
          // Send Response to Client.
          res
            .status(401)
            .send({ status: false, message: 'Builder id not found' });
        }

        const builderData = getBuilder.data();
        // Check builder valid
        if (builderData!.email != req.jwtPayload) {
          res.status(401).send({ status: false, message: 'Not authorized' });
        }

        // Get builder hashed password
        let builderHashPassword = builderData!.password;

        // Compare password
        const isPasswordValid = await comparePassword(
          req.body.current_password,
          builderHashPassword
        );

        // Check password
        if (!isPasswordValid) {
          // Send response to client
          res
            .status(401)
            .send({ status: false, message: 'Password not valid' });
        }

        // const storage = multer.memoryStorage();
        // const upload = multer({ storage: storage }).single('file_photo');
        // res.status(401).send({
        //   status: false,
        //   data: upload,
        //   message: 'Password not dsdsvalid',
        // });

        const builderUpdate: builder = {
          full_name: req.body.full_name ?? builderData!.full_name,
          email: req.body.email ?? builderData!.email,
          password: req.body.password
            ? await hashPassword(req.body.password)
            : builderData!.password,
        };

        const updateBuilder = await docBuilder.update(builderUpdate);
        if (!updateBuilder) {
          // Send log
          console.log('Update builder failed');

          // Send response to client
          res
            .status(500)
            .send({ status: false, message: 'Update builder failed' });
        }

        // Generate JWT Token.
        const jwtToken: string = process.env.JWT_TOKEN_KEY;
        const token = jwt.sign(builderData!.email, jwtToken);
        builderData!.id = getBuilder.id;
        builderData!.token = token;
        builderData!.password = undefined;

        res.status(200).send({
          status: true,
          data: builderData,
          message: 'Update builder successed',
        });
      } catch (error) {
        console.log(error);

        res
          .status(500)
          .send({ status: false, message: 'Update builder failed' });
      }
    })();
  }
);

// Delete builder
app.delete('/delete/:id', auth, (req, res) => {
  (async () => {
    try {
      // Get builder by id
      const docBuilder = firestoreDB.collection('builders').doc(req.params.id);
      const getBuilder = await docBuilder.get();

      // Check builder exists
      if (!getBuilder.exists) {
        // Send Response to Client.
        res
          .status(401)
          .send({ status: false, message: 'Builder id not found' });
      }

      const builderData = getBuilder.data();
      // Check builder valid
      if (builderData!.email != req.jwtPayload) {
        res.status(401).send({ status: false, message: 'Not authorized' });
      }

      const deleteBuilder = await docBuilder.delete();
      if (!deleteBuilder) {
        // Send log
        console.log('Delete builder failed');

        // Send response to client
        res
          .status(500)
          .send({ status: false, message: 'Delete builder failed' });
      }

      // Send response to client
      res
        .status(200)
        .send({ status: true, message: 'Delete builder successed' });
    } catch (error) {
      // Send log
      console.log(error);

      // Send response to client
      res.status(500).send({ status: false, message: 'Delete builder failed' });
    }
  })();
});

exports.app = functions.https.onRequest(app);
