export interface RecipeStepTextRun {
  text: string;
  bold: boolean;
}

export type RecipeStepTextLine = RecipeStepTextRun[];

const BOLD_PATTERN = /\*\*([\s\S]+?)\*\*/g;

export function parseRecipeStepText(value: string): RecipeStepTextLine[] {
  const text = value.replace(/\r\n?/g, '\n');
  const lines: RecipeStepTextLine[] = [[]];
  let cursor = 0;

  const appendSegment = (segment: string, bold: boolean): void => {
    const segmentLines = segment.split('\n');

    segmentLines.forEach((line, index) => {
      if (line) {
        const currentLine = lines.at(-1);
        const previousRun = currentLine?.at(-1);

        if (previousRun?.bold === bold) {
          previousRun.text += line;
        } else {
          currentLine?.push({ text: line, bold });
        }
      }

      if (index < segmentLines.length - 1) {
        lines.push([]);
      }
    });
  };

  for (const match of text.matchAll(BOLD_PATTERN)) {
    const matchIndex = match.index;
    appendSegment(text.slice(cursor, matchIndex), false);
    appendSegment(match[1], true);
    cursor = matchIndex + match[0].length;
  }

  appendSegment(text.slice(cursor), false);
  return lines;
}
