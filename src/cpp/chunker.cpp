#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

struct ChunkResult {
  int count;
  char **chunks;
};

extern "C" {

EMSCRIPTEN_KEEPALIVE
ChunkResult *chunk_text(const char *text) {
  std::vector<std::string> final_chunks;
  
  std::vector<std::string> current_sentences;
  int current_word_count = 0;

  const char *p = text;
  std::string sentence;
  int sentence_words = 0;
  
  auto build_chunk = [](const std::vector<std::string>& sents) {
    std::string res;
    for(size_t i = 0; i < sents.size(); ++i) {
      if(i > 0 && res.back() != ' ' && res.back() != '\n') res += " ";
      res += sents[i];
    }
    return res;
  };

  auto flush_sentence = [&]() {
    if (sentence.empty()) return;

    if (current_word_count + sentence_words > 300 && !current_sentences.empty()) {
      final_chunks.push_back(build_chunk(current_sentences));
      
      // Overlap: keep last 2 sentences
      std::vector<std::string> overlap;
      if (current_sentences.size() >= 2) {
          overlap.push_back(current_sentences[current_sentences.size() - 2]);
          overlap.push_back(current_sentences[current_sentences.size() - 1]);
      } else if (current_sentences.size() == 1) {
          overlap.push_back(current_sentences[0]);
      }
      
      current_sentences = overlap;
      current_word_count = 0;
      for (const auto& s : overlap) {
          for (char c : s) {
              if (c == ' ' || c == '\n') current_word_count++;
          }
      }
    }

    current_sentences.push_back(sentence);
    current_word_count += sentence_words;
    
    sentence = "";
    sentence_words = 0;
  };

  while (*p != '\0') {
    sentence += *p;
    if (*p == ' ' || *p == '\n') {
      sentence_words++;
    }

    // Split on sentence boundaries, or double newlines (paragraphs)
    bool is_sentence_end = (*p == '.' || *p == '!' || *p == '?') && *(p + 1) == ' ';
    bool is_paragraph_end = (*p == '\n' && *(p + 1) == '\n');
    
    if (is_sentence_end) {
      sentence += *(p + 1); // add the space
      sentence_words++;
      p++; // skip the space
      flush_sentence();
    } else if (is_paragraph_end) {
      sentence += *(p + 1); // add the newline
      p++; // skip the newline
      flush_sentence();
    }
    p++;
  }

  flush_sentence();
  if (!current_sentences.empty()) {
    final_chunks.push_back(build_chunk(current_sentences));
  }

  ChunkResult *result = (ChunkResult *)malloc(sizeof(ChunkResult));
  result->count = final_chunks.size();
  result->chunks = (char **)malloc(sizeof(char *) * final_chunks.size());

  for (size_t i = 0; i < final_chunks.size(); i++) {
    result->chunks[i] = strdup(final_chunks[i].c_str());
  }

  return result;
}

EMSCRIPTEN_KEEPALIVE
void free_result(ChunkResult *result) {
  if (result) {
    if (result->chunks) {
      for (int i = 0; i < result->count; i++) {
        free(result->chunks[i]);
      }
      free(result->chunks);
    }
    free(result);
  }
}

} // extern "C"
