import os
import subprocess
import zipfile
import shutil

# This script downloads the dependencies for text generation as ZIP files. Other unnecessary files that are also added need to be manually removed.

script_directory = os.path.dirname(os.path.abspath(__file__))

target_directory = script_directory

os.chdir(target_directory)

packages = [
    'torch',
    'langchain',
    'open_clip_torch'
]

pip_executable = shutil.which("pip")

if not pip_executable:
    raise RuntimeError("pip executable not found. Make sure pip is installed and accessible.")

for package in packages:
    try:
        # Use the full path to pip to avoid any possible path hijacking
        subprocess.run([pip_executable, 'download', package], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error downloading {package}: {e}")
        continue

for package in packages:
    package_wheel_file = None
    for file_name in os.listdir(target_directory):
        if file_name.startswith(package) and file_name.endswith('.whl'):
            package_wheel_file = file_name
            break

    if package_wheel_file:
        zip_file_name = f"{package}.zip"
        with zipfile.ZipFile(zip_file_name, 'w') as zipf:
            zipf.write(package_wheel_file)
        
        os.remove(package_wheel_file)

        
    else:
        print(f"Wheel file for {package} not found.")

