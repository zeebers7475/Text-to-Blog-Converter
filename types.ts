
export interface TrainingExample {
  id: string;
  input: string;
  output: string;
}

export interface Instance {
  id: string;
  name: string;
  trainingExamples: TrainingExample[];
  inputText: string;
  outputHtml: string;
}
