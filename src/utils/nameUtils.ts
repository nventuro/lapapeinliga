export function capitalizeName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      const letterIndex = word.search(/[a-záéíóúüñ]/i);
      if (letterIndex === -1) return word;
      return (
        word.slice(0, letterIndex) +
        word.charAt(letterIndex).toUpperCase() +
        word.slice(letterIndex + 1).toLowerCase()
      );
    })
    .join(' ');
}
