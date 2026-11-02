/** 仅包含脱值原因；不得将组合键值和输入行写进错误。 */
export class ComputationError extends Error {
  constructor(message: string) { super(message); this.name = 'ComputationError'; }
}
