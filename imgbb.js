// imgbb.js - Upload d'images gratuit pour Zyra
// Clé API : 5e309931e43967818ca343159094ff67

// ==================== CONFIGURATION ====================
const IMGBB_API_KEY = '5e309931e43967818ca343159094ff67';
// =======================================================

// ==================== FONCTION PRINCIPALE ====================

/**
 * Upload une image vers ImgBB
 * @param {File} file - Le fichier image à uploader
 * @param {Object} options - Options supplémentaires
 * @param {number} options.maxSizeMB - Taille maximum en MB (défaut: 5)
 * @returns {Promise<string>} URL de l'image sur ImgBB
 */
async function uploadToImgBB(file, options = {}) {
    const { maxSizeMB = 5 } = options;
    
    console.log('📤 Début upload:', file.name, formatBytes(file.size));
    
    // 1. VÉRIFICATION DU FICHIER
    if (!file) {
        throw new Error('Aucun fichier sélectionné');
    }
    
    if (!file.type.startsWith('image/')) {
        throw new Error('Le fichier doit être une image (JPG, PNG, GIF, WebP)');
    }
    
    // 2. VÉRIFICATION DE LA TAILLE
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        throw new Error(`Image trop grande. Maximum: ${maxSizeMB}MB`);
    }
    
    // 3. COMPRESSION SI NÉCESSAIRE
    let finalFile = file;
    if (file.size > 1 * 1024 * 1024) { // Compresser si > 1MB
        try {
            console.log('⚡ Compression de l\'image...');
            finalFile = await compressImage(file);
            console.log('✅ Compressé:', formatBytes(file.size), '→', formatBytes(finalFile.size));
        } catch (compressError) {
            console.warn('⚠️ Compression échouée, utilisation du fichier original:', compressError);
        }
    }
    
    // 4. PRÉPARATION DES DONNÉES
    const formData = new FormData();
    formData.append('image', finalFile);
    
    // URL avec expiration de 6 mois (15552000 secondes)
    const apiUrl = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}&expiration=15552000`;
    
    try {
        console.log('🔄 Envoi à ImgBB...');
        
        // 5. ENVOI À IMGBB
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData
        });
        
        // 6. VÉRIFICATION DE LA RÉPONSE
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        // 7. VÉRIFICATION DU SUCCÈS
        if (data.success === true && data.data && data.data.url) {
            const imageUrl = data.data.url;
            console.log('✅ Upload réussi !');
            console.log('🔗 URL:', imageUrl);
            console.log('📊 Format:', data.data.image.format);
            console.log('📏 Taille:', formatBytes(data.data.size));
            
            return imageUrl;
        } else {
            // Erreur retournée par ImgBB
            const errorMessage = data.error?.message || 'Erreur inconnue de ImgBB';
            throw new Error(`ImgBB: ${errorMessage}`);
        }
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'upload:', error);
        
        // Messages d'erreur compréhensibles
        let userMessage = error.message;
        
        if (error.message.includes('429')) {
            userMessage = 'Limite quotidienne atteinte (1000 uploads/jour maximum). Réessaie demain.';
        } else if (error.message.includes('network') || error.message.includes('Network')) {
            userMessage = 'Problème de connexion internet. Vérifie ta connexion.';
        } else if (error.message.includes('invalid key') || error.message.includes('API key')) {
            userMessage = 'Clé API ImgBB invalide. Vérifie la configuration.';
        } else if (error.message.includes('timeout')) {
            userMessage = 'Temps d\'attente dépassé. L\'image est peut-être trop lourde.';
        }
        
        throw new Error(userMessage);
    }
}

// ==================== COMPRESSION D'IMAGE ====================

/**
 * Compresse une image côté client
 * @param {File} file - Fichier image original
 * @param {number} maxWidth - Largeur maximum (défaut: 1200px)
 * @param {number} quality - Qualité (0.1 à 1.0, défaut: 0.7)
 * @returns {Promise<File>} Fichier compressé
 */
function compressImage(file, maxWidth = 1200, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const img = new Image();
            
            img.onload = function() {
                // Calcul des dimensions proportionnelles
                let canvasWidth = img.width;
                let canvasHeight = img.height;
                
                if (canvasWidth > maxWidth) {
                    canvasHeight = Math.round((canvasHeight * maxWidth) / canvasWidth);
                    canvasWidth = maxWidth;
                }
                
                // Création du canvas
                const canvas = document.createElement('canvas');
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                
                // Dessin de l'image redimensionnée
                const ctx = canvas.getContext('2d');
                
                // Amélioration de la qualité de redimensionnement
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Fond blanc pour les images PNG transparentes
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                
                // Dessiner l'image
                ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
                
                // Conversion en Blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('La compression a échoué'));
                            return;
                        }
                        
                        // Créer un nouveau fichier avec le nom d'origine (mais extension .jpg)
                        const fileName = file.name.replace(/\.[^/.]+$/, "") + '.jpg';
                        const compressedFile = new File([blob], fileName, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        
                        resolve(compressedFile);
                    },
                    'image/jpeg', // Toujours convertir en JPEG pour meilleure compression
                    quality
                );
            };
            
            img.onerror = () => {
                reject(new Error('Impossible de charger l\'image'));
            };
            
            img.src = event.target.result;
        };
        
        reader.onerror = () => {
            reject(new Error('Erreur de lecture du fichier'));
        };
        
        reader.readAsDataURL(file);
    });
}

// ==================== UPLOAD MULTIPLE ====================

/**
 * Upload plusieurs images vers ImgBB
 * @param {File[]} files - Tableau de fichiers images
 * @param {Object} options - Options
 * @param {number} options.maxFiles - Nombre maximum de fichiers (défaut: 3)
 * @returns {Promise<string[]>} Tableau d'URLs
 */
async function uploadMultipleToImgBB(files, options = {}) {
    const { maxFiles = 3 } = options;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
        return [];
    }
    
    // Limiter le nombre de fichiers
    const filesToUpload = files.slice(0, maxFiles);
    console.log(`📤 Upload de ${filesToUpload.length} image(s)`);
    
    // Upload en parallèle
    const uploadPromises = filesToUpload.map((file, index) => {
        return uploadToImgBB(file).catch(error => {
            console.error(`❌ Échec upload ${file.name}:`, error.message);
            return null; // Retourner null pour les échecs
        });
    });
    
    const results = await Promise.all(uploadPromises);
    
    // Filtrer les uploads réussis
    const successfulUrls = results.filter(url => url !== null);
    
    console.log(`✅ ${successfulUrls.length}/${filesToUpload.length} upload(s) réussi(s)`);
    return successfulUrls;
}

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Formate les octets en unités lisible (KB, MB, GB)
 * @param {number} bytes - Nombre d'octets
 * @param {number} decimals - Nombre de décimales
 * @returns {string} Taille formatée
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Teste la connexion à l'API ImgBB
 * @returns {Promise<boolean>} true si la connexion réussit
 */
async function testImgBBConnection() {
    console.log('🔧 Test de connexion à ImgBB...');
    
    // Vérifier que la clé API est configurée
    if (!IMGBB_API_KEY || IMGBB_API_KEY === 'INSÈRE_TA_CLÉ_API_ICI') {
        console.error('❌ Clé API non configurée');
        return false;
    }
    
    // Créer une image de test très petite (1x1 pixel)
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8A2BE2'; // Couleur violette Zyra
    ctx.fillRect(0, 0, 1, 1);
    
    try {
        // Convertir en Blob
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png');
        });
        
        const testFile = new File([blob], 'test.png', { type: 'image/png' });
        
        // Tester l'upload
        const url = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;
        const formData = new FormData();
        formData.append('image', testFile);
        
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Connexion ImgBB réussie !');
            console.log('📊 Plan:', data.data?.image?.format ? 'Gratuit' : 'Inconnu');
            return true;
        } else {
            console.error('❌ Connexion échouée:', data.error?.message || 'Erreur inconnue');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Erreur de test:', error.message);
        return false;
    }
}

/**
 * Vérifie si le navigateur supporte toutes les fonctionnalités nécessaires
 * @returns {boolean} true si toutes les fonctionnalités sont supportées
 */
function checkBrowserSupport() {
    const requirements = {
        'fetch API': typeof fetch === 'function',
        'FileReader API': typeof FileReader !== 'undefined',
        'Canvas API': (() => {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext && canvas.getContext('2d'));
        })(),
        'FormData API': typeof FormData !== 'undefined',
        'Blob API': typeof Blob !== 'undefined',
        'Promise API': typeof Promise !== 'undefined'
    };
    
    const unsupported = [];
    
    for (const [feature, supported] of Object.entries(requirements)) {
        if (!supported) {
            unsupported.push(feature);
        }
    }
    
    if (unsupported.length > 0) {
        console.warn('⚠️ Fonctionnalités non supportées:', unsupported.join(', '));
        return false;
    }
    
    return true;
}

// ==================== GESTION DES ERREURS ====================

// Intercepter les erreurs non gérées
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && 
        (event.reason.message.includes('ImgBB') || 
         event.reason.message.includes('upload'))) {
        console.error('💥 Erreur ImgBB non gérée:', event.reason);
    }
});

// ==================== EXPORT ====================

// Les fonctions sont automatiquement disponibles globalement
// car ce fichier est inclus avec <script src="imgbb.js">

// ==================== INITIALISATION ====================

// Vérifier le support du navigateur au chargement
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const isSupported = checkBrowserSupport();
        
        if (isSupported) {
            console.log('✅ imgbb.js - Prêt à utiliser');
            console.log('🔑 Clé API:', IMGBB_API_KEY.substring(0, 8) + '***');
            console.log('📝 Utilisation:');
            console.log('   const url = await uploadToImgBB(file);');
            console.log('   const urls = await uploadMultipleToImgBB([file1, file2]);');
            
            // Test automatique optionnel (décommenter si besoin)
            // testImgBBConnection().then(success => {
            //     if (!success) {
            //         console.warn('⚠️ Vérifie ta clé API ImgBB');
            //     }
            // });
        } else {
            console.warn('⚠️ imgbb.js - Navigateur incompatible');
        }
    });
} else {
    // Environnement non-navigateur (Node.js)
    console.log('✅ imgbb.js chargé (mode non-navigateur)');
}

// Message de confirmation
console.log('🎉 Module ImgBB chargé avec succès !');
console.log('========================================');
console.log('ZYRA - Image Upload Service');
console.log('Clé API: ' + IMGBB_API_KEY.substring(0, 8) + '...');
console.log('Limite: 1000 uploads/mois');
console.log('Max taille: 5MB par image');
console.log('========================================');