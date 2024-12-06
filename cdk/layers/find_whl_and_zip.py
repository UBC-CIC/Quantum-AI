import os
import zipfile

# This script finds the .whl file and downloads it as a ZIP
current_directory = os.getcwd()

package_wheel_file = None
for file_name in os.listdir(current_directory):
    if file_name.startswith('langchain_experimental') and file_name.endswith('.whl'):
        package_wheel_file = file_name
        break

if package_wheel_file:
    zip_file_name = f"langchain_experimental.zip"
    with zipfile.ZipFile(zip_file_name, 'w') as zipf:
        zipf.write(package_wheel_file)
    
    os.remove(package_wheel_file)

    
else:
    print("Wheel file for langchain-experimental not found.")