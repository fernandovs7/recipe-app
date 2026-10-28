import { parseRecipeStepText } from './recipe-step-format';

describe('parseRecipeStepText', () => {
  it('separates normal and bold text', () => {
    expect(parseRecipeStepText('Mezcla **muy bien** los ingredientes.')).toEqual([
      [
        { text: 'Mezcla ', bold: false },
        { text: 'muy bien', bold: true },
        { text: ' los ingredientes.', bold: false },
      ],
    ]);
  });

  it('preserves explicit and empty lines', () => {
    expect(parseRecipeStepText('Primera línea\n\n**Tercera línea**')).toEqual([
      [{ text: 'Primera línea', bold: false }],
      [],
      [{ text: 'Tercera línea', bold: true }],
    ]);
  });

  it('supports bold text across line breaks', () => {
    expect(parseRecipeStepText('**Una línea\ny otra**')).toEqual([
      [{ text: 'Una línea', bold: true }],
      [{ text: 'y otra', bold: true }],
    ]);
  });

  it('keeps unmatched markers as plain text', () => {
    expect(parseRecipeStepText('Agrega **sal al gusto')).toEqual([
      [{ text: 'Agrega **sal al gusto', bold: false }],
    ]);
  });
});
