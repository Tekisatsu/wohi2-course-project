
const bcrypt = require("bcrypt")
const { resetDb, registerAndLogin, request, app, prisma, createQuestion } = require("./helpers");

beforeEach(resetDb);

it("registers, hashes the password, returns a token", async () => {
      const res = await request(app).post("/api/auth/register")
            .send({ email: "a@test.io", password: "pw12345", name: "A" });

      expect(res.status).toBe(201);
      expect(res.body.token).toEqual(expect.any(String));

      const user = await prisma.user.findUnique({ where: { email: "a@test.io" } });
      expect(user.password).not.toBe("pw12345");                          // not plain
      expect(await bcrypt.compare("pw12345", user.password)).toBe(true);  // valid hash
});
it("returns 403 when editing someone else's post", async () => {
      const aliceToken = await registerAndLogin("alice@test.io", "Alice");
      const q = await createQuestion(aliceToken, { question: "Alice's post", answer: "Y" });

      const bobToken = await registerAndLogin("bob@test.io", "Bob");
      const res = await request(app).put(`/api/questions/${q.id}`)
            .set("Authorization", `Bearer ${bobToken}`)
            .send({ question: "hijacked", answer: "Y" });

      expect(res.status).toBe(403);

      const after = await prisma.quiz.findUnique({ where: { id: q.id } });
      expect(after.question).toBe("Alice's post");  // unchanged
});