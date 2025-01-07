import { useState } from "react";
import PropTypes from "prop-types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/cjs/styles/prism";
import Markdown from "https://esm.sh/react-markdown@9";
import { FaStar } from "react-icons/fa";
import { FaRegCommentDots } from "react-icons/fa";
import logo from "../assets/logo.png";

const AIMessage = ({ message, handleFeedbackSubmit, messageId }) => {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [description, setDescription] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const renderCodeBlock = (code, language) => {
    return (
      <SyntaxHighlighter
        language={language.toLowerCase()}
        style={dracula}
        customStyle={{
          fontSize: "0.85em",
        }}
      >
        {code}
      </SyntaxHighlighter>
    );
  };

  const handleRatingClick = (value) => {
    setRating(value);
  };

  const handleSubmit = () => {
    if (rating === 0) {
      handleFeedbackSubmit(rating, description, messageId);
    } else{
      handleFeedbackSubmit(rating, description, messageId);
      setFeedbackSubmitted(true);
      setShowFeedbackForm(false);
      setRating(0);
      setDescription("");
    }
  };

  return (
    <div className="ml-16 mb-6 mr-16">
      <div className="flex flex-row flex-start">
        <img src={logo} alt="logo" className="w-10 h-10" />
        <div className="text-start ml-4 text-black" style={{ maxWidth: "61vw", width: "61vw", wordWrap: "break-word" }}>
          {message.split("```").map((part, index) => {
            if (index % 2 === 1) {
              const [language, ...codeLines] = part.split("\n");
              const code = codeLines.join("\n");
              return renderCodeBlock(code, language.trim());
            }
            return <Markdown key={index}>{part}</Markdown>;
          })}
        </div>
        <button 
          onClick={() => setShowFeedbackForm(!showFeedbackForm)} 
          className="ml-2 text-gray-500 hover:text-gray-700"
        >
          <FaRegCommentDots size={20} />
        </button>
      </div>
      {showFeedbackForm && !feedbackSubmitted && (
        <div className="mt-4 ml-14 p-4 bg-gray-100 rounded-md">
          <h3 className="text-lg font-semibold mb-2 text-black">How was your experience with Quantum AI?</h3>
          <div className="mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRatingClick(star)}
                className={`text-2xl ${star <= rating ? "text-yellow-500" : "text-gray-300"}`}
              >
                <FaStar />
              </button>
            ))}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)} // Limit to 500 characters
            placeholder="Enter your feedback..."
            className="w-full p-2 border rounded-md bg-white text-black"
            maxLength="1000" 
            rows="3"
          />
          <button
            onClick={handleSubmit}
            className="mt-2 px-4 py-2 text-white rounded-md"
            style={{
              backgroundColor: "#114153",
              transition: "background-color 0.3s",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#0d3140")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#114153")}
          >
            Submit Feedback
          </button>
        </div>
      )}
      {feedbackSubmitted && (
        <div className="mt-4 ml-14 p-4 bg-green-100 text-green-700 rounded-md">
          Thank you for your feedback!
        </div>
      )}
    </div>
  );
};

AIMessage.propTypes = {
  message: PropTypes.string.isRequired,
  messageId: PropTypes.string.isRequired,
  handleFeedbackSubmit: PropTypes.func.isRequired,
};

export default AIMessage;
