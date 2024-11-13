import { useEffect, useRef } from "react";

function convertTimezone(sessionName) {
  if (sessionName === "New chat") {
      return sessionName;
  }

  const splitIndex = sessionName.indexOf(" - ");
  const timestamp = sessionName.substring(0, splitIndex);
  const topic = sessionName.substring(splitIndex + 3);

  const utcDate = new Date(`${timestamp}Z`);
  const options = { 
    year: "numeric", 
    month: "numeric", 
    day: "numeric", 
    hour: "numeric", 
    minute: "numeric" 
  };
  const localTimestamp = utcDate.toLocaleString("en-US", options);

  return `${localTimestamp} - ${topic}`;
}

const Session = ({
  text,
  session,
  setSession,
  deleteSession,
  selectedSession,
  setMessages,
}) => {
  const sessionRef = useRef(null);
  const deleting = false;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sessionRef.current && !sessionRef.current.contains(event.target)) {
        // Do nothing as editing functionality is removed
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isSelected = selectedSession && selectedSession.session_id === session.session_id;

  const handleSessionClick = () => {
    if (selectedSession && selectedSession.session_id !== session.session_id) {
      setMessages([]);
    }
    setSession(session);
  };

  const handleDeleteClick = (event) => {
    event.stopPropagation();
    deleteSession(session);
  };

  const convertedSessionName = convertTimezone(text);

  return (
    <div
      onClick={handleSessionClick}
      style={{
        background: "#1E1818",
      }}
      className={`cursor-pointer rounded flex flex-row justify-between items-center my-2 mx-4 py-2 px-4 ${
        !isSelected ? "opacity-80" : ""
      }`}
    >
      <div className="flex flex-row items-center justify-start gap-6">
        <img src="/message.png" alt="message" className="w-3 h-3" />
        <div className="text-[#e8e8e8] font-light font-inter text-xs">
          {deleting ? "Deleting chat..." : convertedSessionName}
        </div>
      </div>
      <div
        onClick={handleDeleteClick}
        className="cursor-pointer w-3 h-3 flex items-center justify-center ml-2"
        style={{ marginLeft: "8px" }}
      >
        <img src="/delete.png" alt="delete" className="w-3 h-3 transform transition-transform duration-50 hover:scale-125" />
      </div>
    </div>
  );
};

export default Session;
