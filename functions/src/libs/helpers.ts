import * as bcrypt from 'bcrypt';

/**
 *
 * @export
 * @param {string} plaintextPassword
 * @return {Promise}
 */
export async function hashPassword(plaintextPassword: string) {
  const hash = await bcrypt.hash(plaintextPassword, 10);

  return hash;
}

/**
 *
 * @export
 * @param {string} plaintextPassword
 * @param {string} hash
 * @return {Promise}
 */
export async function comparePassword(plaintextPassword: string, hash: string) {
  const result = await bcrypt.compare(plaintextPassword, hash);

  return result;
}

/**
 *
 * @param {EpochTimeStamp | undefined} unixtime
 * @return {string}
 */
export function humanDate(unixtime: EpochTimeStamp | undefined) {
  const newDate = new Date();
  newDate.setTime(unixtime ?? Date.now());

  return newDate.toDateString();
}
