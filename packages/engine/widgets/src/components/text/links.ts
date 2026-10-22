export interface TextBlockLink {
  label: string;
  href?: string;
  disabled?: boolean;
  onclick?: (event: MouseEvent) => void;
}
