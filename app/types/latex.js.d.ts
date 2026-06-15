declare module "latex.js" {
  export interface HtmlGeneratorOptions {
    hyphenate?: boolean;
  }

  export class HtmlGenerator {
    constructor(options?: HtmlGeneratorOptions);
  }

  export interface LatexDocument {
    htmlDocument(): Document;
  }

  export function parse(latex: string, options?: { generator: HtmlGenerator }): LatexDocument;
}
