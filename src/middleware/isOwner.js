const prisma = require("../lib/prisma");

async function isOwner(req, res, next) {
      const id = Number(req.params.id);
      const question = await prisma.quiz.findUnique({
            where: { id },
      });

      if (!question) {
            throw new NotFoundError("Question not found");
      }

      if (question.userId !== req.user.userId) {
            throw new ForbiddenError("You can only modify your own questions");
      }

      // Attach the record to the request so the route handler can reuse it
      req.question = question;
      next();

}

module.exports = isOwner;