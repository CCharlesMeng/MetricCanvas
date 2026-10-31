// Synthetic deployment only. No private SDK, identity mapping or production URL.
window.MetricCanvasDeploymentAdapter = {
  contractVersion: '1',
  connect(input) {
    const props = { ...input.platformProps };
    if (input.mode !== 'legacy') {
      props.readPanguDeployment = () => {
        input.receipts.read++;
        if (input.mode === 'throw') throw Error('private-reader-diagnostic');
        return input.deployment;
      };
    }
    if (input.mode === 'custom') {
      props.dialogueAdapter = {
        async mount(element) {
          input.receipts.mounted++;
          element.textContent = '部署自有对话';
          return () => { input.receipts.destroyed++; element.textContent = ''; };
        }
      };
    }
    return { props, disconnect() { input.receipts.disconnected++; } };
  }
};
