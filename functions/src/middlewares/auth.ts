import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

dotenv.config();

export const auth = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(403).send({
      status: false,
      msg: 'A Bearer Token is required for authentication',
    });
  }

  try {
    const authHeaderArr = authHeader.split(' ');
    const bearerToken = authHeaderArr[1];
    const jwtToken = process.env.JWT_TOKEN_KEY;
    const jwtPayload = jwt.verify(bearerToken, jwtToken);
    req.jwtPayload = jwtPayload;
  } catch (err) {
    return res.status(401).send({ status: false, msg: 'Not authorized.' });
  }

  return next();
};
