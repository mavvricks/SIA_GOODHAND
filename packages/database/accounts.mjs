import { postgresEnabled, queryDatabase } from "./postgres.mjs";
import { getLocalDatabase } from "../local-db/index.mjs";
export function accountDatabase(system) {
  if (!postgresEnabled(system)) return getLocalDatabase(system);
  const query = (sql, args) => queryDatabase(system, sql, args);
  return {
    async findUser(email) {
      return (
        await query(
          "SELECT * FROM goodhand.users WHERE lower(email)=lower($1) AND active=true",
          [email],
        )
      ).rows[0];
    },
    async userById(id) {
      return (
        await query(
          "SELECT * FROM goodhand.users WHERE id=$1 AND active=true",
          [id],
        )
      ).rows[0];
    },
    async addUser(user) {
      await query(
        "INSERT INTO goodhand.users(id,email,password_hash,role,full_name,active,created_at) VALUES($1,lower($2),$3,$4,$5,true,now())",
        [user.id, user.email, user.passwordHash, user.role, user.fullName],
      );
    },
    async createSession(id, userId, expiresAt) {
      await query(
        "INSERT INTO goodhand.sessions(id,user_id,expires_at,created_at) VALUES($1,$2,$3,$4)",
        [id, userId, expiresAt, Date.now()],
      );
    },
    async sessionUser(id, userId) {
      return (
        await query(
          "SELECT u.* FROM goodhand.users u JOIN goodhand.sessions s ON s.user_id=u.id WHERE s.id=$1 AND u.id=$2 AND s.expires_at>$3 AND u.active=true",
          [id, userId, Date.now()],
        )
      ).rows[0];
    },
    async revokeSession(id) {
      await query("DELETE FROM goodhand.sessions WHERE id=$1", [id]);
    },
  };
}
