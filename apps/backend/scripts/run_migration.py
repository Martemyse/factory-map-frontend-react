#!/usr/bin/env python3
"""
Simple runner script for the data migration.
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from populate_layers_features import main

if __name__ == "__main__":
    main()
