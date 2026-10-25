-- The note asks its question and the person it's for opens it, and can write back: there are no boxes to tick, so no
-- third box, no answer, and no ticked card.
DROP INDEX IF EXISTS "Note_answer_idx";
ALTER TABLE "Note" DROP COLUMN "escape", DROP COLUMN "answer", DROP COLUMN "answeredAt", DROP COLUMN "answerCard";
ALTER TABLE "Ask" DROP COLUMN "answeredAt";
