const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

const seedQuestions = [
      {
            question: "What Girl can start with a (legal) gun in Girl Frame??",
            answer: "Princess",
      },
      {
            question: "How much Experience does the Newgirl need to swap one of its rules?",
            answer: "3"
      },
      {
            question: "What is the max amount of Identies a Girl can have in Girl Frame?",
            answer: "4",
      },
      {
            question: "Which Girl has the rule 'Barely a Girl'?",
            answer: "Casualty",
      },
];

async function main() {
      await prisma.user.deleteMany();
      await prisma.quiz.deleteMany();
      // Create a default user
      const hashedPassword = await bcrypt.hash("1234", 10);
      const user = await prisma.user.create({
            data: {
                  email: "admin@example.com",
                  password: hashedPassword,
                  name: "Admin User",
            },
      });

      console.log("Created user:", user.email);

      for (const question of seedQuestions) {
            await prisma.quiz.create({
                  data: {
                        userId: user.id,
                        question: question.question,
                        answer: question.answer,
                  },
            });
      }

      console.log("Seed data inserted successfully");
}

main()
      .catch((e) => {
            console.error(e);
            process.exit(1);
      })
      .finally(() => prisma.$disconnect());