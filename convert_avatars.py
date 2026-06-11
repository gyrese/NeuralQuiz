import os
import sys
import subprocess

# S'assurer que Pillow est installé
try:
    from PIL import Image
except ImportError:
    print("[INFO] Pillow n'est pas installé. Tentative d'installation...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])
        from PIL import Image
        print("[SUCCESS] Pillow a été installé avec succès.")
    except Exception as e:
        print(f"[ERROR] Impossible d'installer Pillow: {e}")
        print("Veuillez installer Pillow manuellement: pip install pillow")
        sys.exit(1)

def convert_avatars():
    src_dir = os.path.join(os.path.dirname(__file__), "avatar")
    dest_dir = os.path.join(os.path.dirname(__file__), "client", "public", "avatars")
    
    if not os.path.exists(src_dir):
        print(f"[ERROR] Le dossier source '{src_dir}' n'existe pas.")
        print("Veuillez créer le dossier 'avatar' à la racine du projet et y placer vos images.")
        return
        
    os.makedirs(dest_dir, exist_ok=True)
    
    # Récupérer tous les fichiers du dossier
    supported_extensions = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif")
    files = [f for f in os.listdir(src_dir) if f.lower().endswith(supported_extensions)]
    
    if not files:
        print(f"[WARNING] Aucun fichier d'image trouvé dans '{src_dir}'.")
        print(f"Extensions supportées: {', '.join(supported_extensions)}")
        return
        
    # Trier les fichiers pour avoir un ordre stable
    files.sort()
    
    print(f"[INFO] Début de la conversion de {len(files)} images...")
    
    # Générer exactement 60 fichiers (en bouclant sur les fichiers sources s'il y en a moins de 60)
    target_count = 60
    converted_count = 0
    
    print(f"[INFO] Début de la conversion pour générer exactement {target_count} avatars...")
    
    for idx in range(target_count):
        filename = files[idx % len(files)]
        src_path = os.path.join(src_dir, filename)
        dest_filename = f"avatar_{idx + 1}.webp"
        dest_path = os.path.join(dest_dir, dest_filename)
        
        try:
            with Image.open(src_path) as img:
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGBA')
                
                # Redimensionner l'avatar en 256x256
                img = img.resize((256, 256), Image.Resampling.LANCZOS)
                
                img.save(dest_path, "WEBP", quality=90)
                is_duplicate = idx >= len(files)
                dup_str = " (Duplication)" if is_duplicate else ""
                print(f"[OK] {filename} -> {dest_filename}{dup_str}")
                converted_count += 1
        except Exception as e:
            print(f"[ERROR] Échec de la conversion pour {filename}: {e}")
            
    print(f"[SUCCESS] Conversion terminée: {converted_count} images générées dans '{dest_dir}'.")

if __name__ == "__main__":
    convert_avatars()
