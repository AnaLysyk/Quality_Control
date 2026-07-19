export const describeDb: typeof describe =
  process.env.QC_TEST_WITH_DB ? describe : describe.skip;

export const itDb: typeof it =
  process.env.QC_TEST_WITH_DB ? it : it.skip;

