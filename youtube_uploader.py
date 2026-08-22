import os
import sys
import json
import requests

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
YOUTUBE_PLAYLISTS_URL = "https://www.googleapis.com/youtube/v3/playlists"
YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
YOUTUBE_PLAYLIST_ITEMS_URL = "https://www.googleapis.com/youtube/v3/playlistItems"

def get_access_token(client_id: str = None, client_secret: str = None, refresh_token: str = None) -> str:
    """Exchanges Google OAuth2 Refresh Token for a fresh Access Token."""
    cid = client_id or os.getenv("YOUTUBE_CLIENT_ID")
    csecret = client_secret or os.getenv("YOUTUBE_CLIENT_SECRET")
    rtoken = refresh_token or os.getenv("YOUTUBE_REFRESH_TOKEN")

    if not (cid and csecret and rtoken):
        print("[YOUTUBE] Missing OAuth credentials (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN).")
        return None

    data = {
        "client_id": cid,
        "client_secret": csecret,
        "refresh_token": rtoken,
        "grant_type": "refresh_token"
    }

    try:
        res = requests.post(GOOGLE_TOKEN_URL, data=data, timeout=15)
        if res.status_code == 200:
            token_data = res.json()
            return token_data.get("access_token")
        else:
            print(f"[YOUTUBE ERROR] Token exchange failed ({res.status_code}): {res.text}")
            return None
    except Exception as e:
        print(f"[YOUTUBE ERROR] Failed to fetch access token: {e}")
        return None

def fetch_user_playlists(access_token: str = None) -> list:
    """Fetches user's YouTube playlists."""
    token = access_token or get_access_token()
    if not token:
        return []

    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "part": "snippet,contentDetails",
        "mine": "true",
        "maxResults": 50
    }

    try:
        res = requests.get(YOUTUBE_PLAYLISTS_URL, headers=headers, params=params, timeout=15)
        if res.status_code == 200:
            data = res.json()
            items = data.get("items", [])
            playlists = []
            for item in items:
                playlists.append({
                    "id": item.get("id"),
                    "title": item.get("snippet", {}).get("title"),
                    "description": item.get("snippet", {}).get("description", ""),
                    "itemCount": item.get("contentDetails", {}).get("itemCount", 0)
                })
            return playlists
        else:
            print(f"[YOUTUBE ERROR] Failed to fetch playlists ({res.status_code}): {res.text}")
            return []
    except Exception as e:
        print(f"[YOUTUBE ERROR] Error fetching playlists: {e}")
        return []

def add_video_to_playlist(video_id: str, playlist_id: str, access_token: str) -> bool:
    """Assigns an uploaded YouTube video to a specific playlist."""
    if not (video_id and playlist_id and access_token):
        return False

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    body = {
        "snippet": {
            "playlistId": playlist_id,
            "resourceId": {
                "kind": "youtube#video",
                "videoId": video_id
            }
        }
    }

    try:
        res = requests.post(f"{YOUTUBE_PLAYLIST_ITEMS_URL}?part=snippet", headers=headers, json=body, timeout=20)
        if res.status_code in [200, 201]:
            print(f"[YOUTUBE SUCCESS] Added video {video_id} to playlist {playlist_id}.")
            return True
        else:
            print(f"[YOUTUBE ERROR] Failed to add video to playlist ({res.status_code}): {res.text}")
            return False
    except Exception as e:
        print(f"[YOUTUBE ERROR] Playlist assignment error: {e}")
        return False

def upload_video_to_youtube(video_path: str, title: str, description: str, playlist_id: str = None, privacy_status: str = "public", client_id: str = None, client_secret: str = None, refresh_token: str = None) -> dict:
    """
    Uploads MP4 video to YouTube and optionally assigns it to a playlist.
    Returns dict with success status, video_id, and youtube_url.
    """
    if not os.path.exists(video_path):
        return {"success": False, "error": f"Plik wideo nie istnieje: {video_path}"}

    token = get_access_token(client_id, client_secret, refresh_token)
    if not token:
        return {"success": False, "error": "Brak poprawnego tokenu dostępu YouTube API (OAuth2 refresh token)."}

    # 1. Initiate Resumable Upload
    metadata = {
        "snippet": {
            "title": title[:100],
            "description": description[:5000],
            "tags": ["widokinaraj", "rhz365", "wnr365", "modlitwa", "rozważania"],
            "categoryId": "22" # People & Blogs
        },
        "status": {
            "privacyStatus": privacy_status.lower(),
            "selfDeclaredMadeForKids": False
        }
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4"
    }

    try:
        print(f"[YOUTUBE UPLOAD] Initiating resumable upload for {video_path}...")
        init_res = requests.post(
            f"{YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status",
            headers=headers,
            json=metadata,
            timeout=30
        )

        if init_res.status_code != 200:
            return {"success": False, "error": f"Inicjalizacja uploadu YouTube nie powiodła się ({init_res.status_code}): {init_res.text}"}

        upload_url = init_res.headers.get("Location")
        if not upload_url:
            return {"success": False, "error": "Brak adresu sesji uploadu od YouTube API."}

        # 2. Upload video binary
        file_size = os.path.getsize(video_path)
        with open(video_path, "rb") as f_video:
            upload_headers = {
                "Content-Type": "video/mp4",
                "Content-Length": str(file_size)
            }
            print(f"[YOUTUBE UPLOAD] Uploading binary data ({file_size / (1024*1024):.2f} MB)...")
            upload_res = requests.put(upload_url, headers=upload_headers, data=f_video, timeout=600)

        if upload_res.status_code in [200, 201]:
            video_data = upload_res.json()
            video_id = video_data.get("id")
            youtube_url = f"https://www.youtube.com/watch?v={video_id}"
            print(f"[YOUTUBE SUCCESS] Upload completed! Video URL: {youtube_url}")

            # 3. Add to Playlist if specified
            if playlist_id:
                add_video_to_playlist(video_id, playlist_id, token)

            return {
                "success": True,
                "videoId": video_id,
                "youtubeUrl": youtube_url,
                "playlistId": playlist_id
            }
        else:
            return {"success": False, "error": f"Wgrywanie pliku wideo nie powiodło się ({upload_res.status_code}): {upload_res.text}"}

    except Exception as e:
        print(f"[YOUTUBE ERROR] Exception during video upload: {e}")
        return {"success": False, "error": str(e)}
