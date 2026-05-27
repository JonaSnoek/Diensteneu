import os
import json
import zipfile
from pathlib import Path
from typing import Dict, Any, Tuple

def validate_and_extract_zip(zip_path: Path, extract_dir: Path) -> Tuple[Dict[str, Any], Path]:
    """
    Validates the zip file structure, ensures no path traversal attacks (Zip Slip),
    parses manifest.json, and extracts files.
    Returns: (manifest_data, final_extracted_folder)
    """
    if not zipfile.is_zipfile(zip_path):
        raise ValueError("Invalid file format. Must be a ZIP archive.")
        
    manifest_data = {}
    
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # 1. Path traversal check (Zip Slip defense)
        for member in zip_ref.infolist():
            # Resolve target path
            target_path = Path(os.path.abspath(extract_dir / member.filename))
            # Resolve base extraction directory
            resolved_base = Path(os.path.abspath(extract_dir))
            
            # Check if target path starts with base extraction directory path
            if not str(target_path).startswith(str(resolved_base)):
                raise PermissionError(f"Security Alert: Attempted path traversal detected in ZIP member: {member.filename}")
        
        # 2. Find manifest.json (could be at root or inside a single top-level folder)
        manifest_member = None
        for member in zip_ref.namelist():
            if member.endswith("manifest.json"):
                manifest_member = member
                break
                
        if not manifest_member:
            raise ValueError("ZIP archive is missing manifest.json.")
            
        # Read manifest content
        with zip_ref.open(manifest_member) as f:
            try:
                manifest_data = json.load(f)
            except json.JSONDecodeError:
                raise ValueError("manifest.json contains invalid JSON syntax.")
                
        # Validate manifest mandatory fields
        required_fields = ["id", "name", "version"]
        for field in required_fields:
            if field not in manifest_data:
                raise ValueError(f"manifest.json is missing required field: '{field}'")
                
        module_id = manifest_data["id"]
        # Ensure module_id is alphanumeric/dashes only (security sanitize)
        if not module_id.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Module ID in manifest.json must contain only alphanumeric characters, dashes, or underscores.")

        # Create final module destination
        final_dest = extract_dir / module_id
        final_dest.mkdir(parents=True, exist_ok=True)
        
        # Determine extraction root offset (if ZIP files are nested inside a single folder, e.g. /my-tool/index.html)
        # We will extract everything directly. If it is nested inside a subfolder, we can pull it up or keep it.
        # Let's extract to a temporary folder inside extract_dir, then resolve structure.
        temp_extract = extract_dir / f"temp_{module_id}"
        temp_extract.mkdir(parents=True, exist_ok=True)
        
        try:
            zip_ref.extractall(temp_extract)
            
            # Let's check where the manifest.json actually ended up
            found_manifest_path = None
            for root, dirs, files in os.walk(temp_extract):
                if "manifest.json" in files:
                    found_manifest_path = Path(root)
                    break
            
            if not found_manifest_path:
                raise ValueError("Could not find manifest.json after temporary extraction.")
                
            # Move all contents from the found manifest directory to the final_dest
            import shutil
            for item in os.listdir(found_manifest_path):
                source = found_manifest_path / item
                dest = final_dest / item
                if dest.exists():
                    if dest.is_dir():
                        shutil.rmtree(dest)
                    else:
                        dest.unlink()
                shutil.move(str(source), str(dest))
                
        finally:
            # Clean up temp folder
            import shutil
            if temp_extract.exists():
                shutil.rmtree(temp_extract)
                
    return manifest_data, final_dest
