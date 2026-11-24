import { expect, it } from "vitest";
import { parseCommandArguments } from "./command-arguments";

it("preserves quoted paths, empty arguments, and JSON argument arrays", () => {
  expect(
    parseCommandArguments('-y server "a directory/file" \'two words\' ""')
  ).toEqual(["-y", "server", "a directory/file", "two words", ""]);
  expect(
    parseCommandArguments('["C:\\\\Program Files\\\\server", "--flag"]')
  ).toEqual(["C:\\Program Files\\server", "--flag"]);
});
it("rejects unfinished quotes and non-string JSON arguments", () => {
  expect(() => parseCommandArguments('"unfinished')).toThrow();
  expect(() => parseCommandArguments("[42]")).toThrow();
});
