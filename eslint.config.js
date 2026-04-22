import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    plugins: {
      'firebase-security-rules': firebaseRulesPlugin
    },
    rules: {
      // You can add specific rules here if needed, but the instruction just says to use recommended.
    }
  },
  firebaseRulesPlugin.configs['flat/recommended']
]
