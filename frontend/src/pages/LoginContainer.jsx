import React from "react";


// default styled container
const PageContainer = ({ children }) => {
  return (
    <div className="mx-auto flex min-h-screen max-w-full overflow-auto box-border bg-[#2E8797]">
      {children}
    </div>
  );
};

export default PageContainer;
