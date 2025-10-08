#!/usr/bin/env python3
"""
Universal Factory Map Startup Script
Automatically detects OS and starts appropriate services:
- Windows: Development mode (backend: 7998, frontend: 8077)
- Linux: Production mode (backend: 7998, frontend: 8077)
"""

import os
import platform
import subprocess
import sys
import time
import signal
import threading
from pathlib import Path

class FactoryMapStarter:
    def __init__(self):
        self.is_windows = platform.system() == 'Windows'
        self.is_linux = platform.system() == 'Linux'
        self.backend_process = None
        self.frontend_process = None
        
        # Port configuration
        if self.is_windows:
            self.backend_port = 7998
            self.frontend_port = 8077
            self.mode = "Development"
        else:
            self.backend_port = 7998
            self.frontend_port = 8077
            self.mode = "Production"
    
    def print_info(self):
        print("=" * 60)
        print("Factory Map Application Starter")
        print("=" * 60)
        print(f"OS: {platform.system()}")
        print(f"Mode: {self.mode}")
        print(f"Backend Port: {self.backend_port}")
        print(f"Frontend Port: {self.frontend_port}")
        print("=" * 60)
        print()
    
    def check_dependencies(self):
        """Check if required dependencies are available"""
        print("Checking dependencies...")
        
        # Check Python
        try:
            result = subprocess.run([sys.executable, '--version'], 
                                  capture_output=True, text=True, check=True)
            print(f"✓ Python: {result.stdout.strip()}")
        except subprocess.CalledProcessError:
            print("✗ Python not found")
            return False
        
        # Check Node.js
        try:
            result = subprocess.run(['node', '--version'], 
                                  capture_output=True, text=True, check=True)
            print(f"✓ Node.js: {result.stdout.strip()}")
        except subprocess.CalledProcessError:
            print("✗ Node.js not found")
            return False
        
        # Check npm
        try:
            result = subprocess.run(['npm', '--version'], 
                                  capture_output=True, text=True, check=True)
            print(f"✓ npm: {result.stdout.strip()}")
        except subprocess.CalledProcessError:
            print("✗ npm not found")
            return False
        
        print("✓ All dependencies found")
        return True
    
    def start_backend(self):
        """Start the backend server"""
        print(f"Starting Backend Server (Port {self.backend_port})...")
        
        backend_dir = Path("apps/backend")
        if not backend_dir.exists():
            print("✗ Backend directory not found")
            return False
        
        try:
            if self.is_windows:
                self.backend_process = subprocess.Popen(
                    [sys.executable, "run_server.py"],
                    cwd=backend_dir,
                    creationflags=subprocess.CREATE_NEW_CONSOLE
                )
            else:
                self.backend_process = subprocess.Popen(
                    [sys.executable, "run_server.py"],
                    cwd=backend_dir
                )
            
            print(f"✓ Backend started (PID: {self.backend_process.pid})")
            return True
        except Exception as e:
            print(f"✗ Failed to start backend: {e}")
            return False
    
    def start_frontend(self):
        """Start the frontend server"""
        print(f"Starting Frontend Server (Port {self.frontend_port})...")
        
        frontend_dir = Path("apps/frontend")
        if not frontend_dir.exists():
            print("✗ Frontend directory not found")
            return False
        
        try:
            if self.is_windows:
                self.frontend_process = subprocess.Popen(
                    ["npm", "run", "dev"],
                    cwd=frontend_dir,
                    creationflags=subprocess.CREATE_NEW_CONSOLE
                )
            else:
                self.frontend_process = subprocess.Popen(
                    ["npm", "run", "dev"],
                    cwd=frontend_dir
                )
            
            print(f"✓ Frontend started (PID: {self.frontend_process.pid})")
            return True
        except Exception as e:
            print(f"✗ Failed to start frontend: {e}")
            return False
    
    def cleanup(self):
        """Clean up running processes"""
        print("\nStopping servers...")
        
        if self.backend_process:
            try:
                self.backend_process.terminate()
                print("✓ Backend stopped")
            except:
                pass
        
        if self.frontend_process:
            try:
                self.frontend_process.terminate()
                print("✓ Frontend stopped")
            except:
                pass
        
        print("All servers stopped")
    
    def run(self):
        """Main run method"""
        self.print_info()
        
        if not self.check_dependencies():
            print("Please install missing dependencies and try again")
            return 1
        
        print()
        
        # Start backend
        if not self.start_backend():
            return 1
        
        # Wait a bit for backend to start
        print("Waiting for backend to initialize...")
        time.sleep(3)
        
        # Start frontend
        if not self.start_frontend():
            self.cleanup()
            return 1
        
        print()
        print("=" * 60)
        print("Factory Map is running!")
        print("=" * 60)
        print(f"Backend: http://localhost:{self.backend_port}")
        print(f"Frontend: http://localhost:{self.frontend_port}")
        print("=" * 60)
        print()
        print("Press Ctrl+C to stop all servers")
        
        # Set up signal handler for cleanup
        def signal_handler(sig, frame):
            self.cleanup()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        try:
            # Wait for processes
            if self.backend_process:
                self.backend_process.wait()
            if self.frontend_process:
                self.frontend_process.wait()
        except KeyboardInterrupt:
            self.cleanup()
        
        return 0

if __name__ == "__main__":
    starter = FactoryMapStarter()
    sys.exit(starter.run())
