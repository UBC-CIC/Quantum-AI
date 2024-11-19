import { useState } from "react";
import { signOut } from "aws-amplify/auth";
import { useLocation, useNavigate } from "react-router-dom";
import { FaCog, FaCommentDots, FaFileAlt, FaChartBar } from "react-icons/fa";

const UserHeader = ({ admin = false }) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [isSpinning, setIsSpinning] = useState(false);

  const handleSignOut = async (event) => {
    event.preventDefault();
    signOut()
      .then(() => {
        window.location.href = "/";
      })
      .catch((error) => {
        console.error("Error signing out: ", error);
      });
  };

  const toggleDropdown = () => {
    setIsSpinning(true);
    setDropdownOpen((prev) => !prev);
    setTimeout(() => {
      setIsSpinning(false);
    }, 500);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setDropdownOpen(false);
  };

  return (
    <header className="bg-[#F8F9FD] p-4 flex justify-between items-center max-h-20">
      <div className="flex-grow"></div>

      {admin && (
        <div className="relative">
          <button
            className="text-gray-700 hover:text-gray-900 mr-2"
            onClick={toggleDropdown}
          >
            <FaCog size={40} className={`${isSpinning ? "slow-spin" : ""}`} />
          </button>
          <div
            className={`absolute z-50 right-6 w-60 bg-[#1E1818] rounded shadow-lg z-10 opacity-80 transition-all duration-300 ease-in-out transform ${
              isDropdownOpen ? "scale-100" : "scale-0 pointer-events-none"
            }`}
          >
            <div
              onClick={() => handleNavigation("/home")}
              className={`flex items-center p-2 cursor-pointer ${
                location.pathname === "/home" ? "bg-gray-600" : ""
              } hover:bg-gray-600`}
            >
              <FaCommentDots className="text-white ml-2 mr-2 my-2" size={30} />
              <span className="text-white">Chat</span>
            </div>
            <div
              onClick={() => handleNavigation("/manage-topics")}
              className={`flex items-center p-2 cursor-pointer ${
                location.pathname === "/manage-topics" ? "bg-gray-600" : ""
              } hover:bg-gray-600`}
            >
              <FaFileAlt className="text-white ml-2 mr-2 my-2" size={30} />
              <span className="text-white">Manage Topics</span>
            </div>
            <div
              onClick={() => handleNavigation("/analytics")}
              className={`flex items-center p-2 cursor-pointer ${
                location.pathname === "/analytics" ? "bg-gray-600" : ""
              } hover:bg-gray-600`}
            >
              <FaChartBar className="text-white ml-2 mr-2 my-2" size={30} />
              <span className="text-white">Analytics</span>
            </div>
          </div>
        </div>
      )}

      <button
        className="bg-[#2E8797] text-white hover:bg-[#114153] px-4 py-2 rounded"
        onClick={handleSignOut}
      >
        Sign Out
      </button>
    </header>
  );
};

export default UserHeader;
