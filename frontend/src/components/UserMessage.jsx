import { useState } from "react";
import AccountBoxIcon from "@mui/icons-material/AccountBox";
import { FaTrashAlt } from "react-icons/fa"; 
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/cjs/styles/prism";

const UserMessage = ({ message, isMostRecent, onDelete, hasAiMessageAfter }) => {
  const [isHovered, setIsHovered] = useState(false);

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

  return (
    <div
      className="ml-16 mb-6 mr-16"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-row-reverse items-start">
        {/* Chat Bubble for Bot Message */}
        <div
          className="ml-4 mr-2 p-4 bg-gray-200 text-black rounded-xl shadow-md text-left"
          style={{ maxWidth: "60vw", wordWrap: "break-word" }}
        >
          {message.split("```").map((part, index) => {
            if (index % 2 === 1) {
              const [language, ...codeLines] = part.split("\n");
              const code = codeLines.join("\n");
              return renderCodeBlock(code, language.trim());
            }
            return part;
          })}
        </div>
        {/* Conditional render for delete icon */}
        {isHovered && isMostRecent && hasAiMessageAfter && (
          <button
            onClick={onDelete}
            className="ml-2 p-2 hover:bg-gray-200 rounded-full bg-[#F8F9FD]"
            title="Delete this message and all that follow"
          >
            <FaTrashAlt fontSize="small" style={{ color: "red", background: '#F8F9FD' }} />
          </button>
        )}
      </div>
    </div>
  );
};

export default UserMessage;
