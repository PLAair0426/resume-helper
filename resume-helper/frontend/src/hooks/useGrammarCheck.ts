import { useGrammarStore, type GrammarError } from "@/store/useGrammarStore";

export type { GrammarError };

export const useGrammarCheck = () => {
  const {
    errors,
    isChecking,
    selectedErrorIndex,
    checkGrammar,
    clearErrors,
    selectError,
    dismissError,
  } = useGrammarStore();

  return {
    errors,
    isChecking,
    selectedErrorIndex,
    checkGrammar,
    clearErrors,
    selectError,
    dismissError,
  };
};
