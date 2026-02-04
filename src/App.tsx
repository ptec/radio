import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import clsx from "clsx";
import { debounce } from "lodash";
import { Info, ListMusic, Plus, Radio, RotateCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./ui/styles/global.css";

export const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwtfTgh_VX95AR3zYPokQODNzIwxfUf00uWS1wWS5hmCxCAxTtzbbk6PgCe9kPWWO8g/exec";
export const ITUNES_SEARCH_URL      = "https://itunes.apple.com/search";
export const GOOGLE_CLIENT_ID       = "979114722520-k22qukqaqc699ihho59a15ev3iaogvi4.apps.googleusercontent.com";

export type Song = {
  title : string,
  artist: string
}

export type PlaylistEntry = Song & {
  submittedOn: string,
  submittedBy: string,
  status     : string,
  notes      : string,
}

export type Playlist  = Array <        PlaylistEntry>;
export type Playlists = Record<string, Playlist     >;

function wrap(content: any) {
  return encodeURIComponent(JSON.stringify(content))
}

async function unwrap(response: Response) {  ;
  return response.json().then(response => {
         if (response && response.ok === true ) return response.content;
    else if (response && response.ok === false) throw new Error(`[unwrap] ${response.error}`);
    else throw new Error(`[unwrap] Failed to unwrap response '${response}'`);
  })
}

async function getPlaylistIds(accessToken: string) {
  const q = `${GOOGLE_APPS_SCRIPT_URL}?q=${wrap({
    action: "getPlaylistIds",
    accessToken,
  })}`;

  return fetch(q, { method: "POST", redirect: "follow", headers: {
    "Content-Type": "application/x-www-form-urlencoded"
  }}).then(unwrap)
}

async function getPlaylist(accessToken: string, playlistId: string) {
  const q = `${GOOGLE_APPS_SCRIPT_URL}?q=${wrap({
    action: "getPlaylist",
    accessToken,
    playlistId
  })}`;

  return fetch(q, { method: "POST", redirect: "follow", headers: {
    "Content-Type": "application/x-www-form-urlencoded"
  }}).then(unwrap)
}

async function newPlaylist(accessToken: string, playlistId: string) {
  const q = `${GOOGLE_APPS_SCRIPT_URL}?q=${wrap({
    action: "newPlaylist",
    accessToken,
    playlistId 
  })}`;
  
  return fetch(q, { method: "POST", redirect: "follow", headers: {
    "Content-Type": "application/x-www-form-urlencoded"
  }}).then(unwrap)
}

async function addSongRequest(accessToken: string, playlistId: string, artist: string, title: string) {
  const q = `${GOOGLE_APPS_SCRIPT_URL}?q=${wrap({
    action: "addSongRequest",
    accessToken,
    playlistId,
    artist,
    title
  })}`;

  return fetch(q, { method: "POST", headers: {
    "Content-Type": "application/x-www-form-urlencoded"
  }}).then(unwrap)
}

async function searchSongs(term: string): Promise<Song[]> {
  if (!term.trim()) return [];

  const params = new URLSearchParams({
    term,
    media : "music",
    entity: "song",
    limit : "50"
  });

  const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
  if (!res.ok) throw new Error("iTunes search failed");

  const data = await res.json();

  const seen = new Set<string>();

  //@ts-ignore
  return data.results.reduce<Song[]>((songs, item: any) => {
    const title  = item.trackName ;
    const artist = item.artistName;

    if (!title || !artist) return songs;

    const id = `${artist.toLowerCase()}|${title.toLowerCase()}`;
    if (seen.has(id)) return songs;

    seen .add(id);
    songs.push({ title, artist });
    return songs;
  }, []).splice(0, 10);
}

export default function App() {
  const [accessToken, setAccessToken] = useState("");

  const [playlists  , setPlaylists  ] = useState<Playlists>({});
  const [selectedId , setSelectedId ] = useState<      string >("");
  const [playlistIds, setPlaylistIds] = useState<Array<string>>([]);

  const [fetchingPlaylist   , setFetchingPlaylist   ] = useState(  0  );
  const [fetchingPlaylistIds, setFetchingPlaylistIds] = useState(false);

  const loginWithGoogle = useGoogleLogin({
    onSuccess({access_token}) {
      setAccessToken(access_token);
    }
  });

  useEffect(() => {
    if (!accessToken) return;
    setFetchingPlaylistIds(true);
    getPlaylistIds(accessToken)
      .then(playlistIds => {
        setPlaylistIds(playlistIds   )
        setSelectedId (playlistIds[0])
      })
      .finally(() => {
        setFetchingPlaylistIds(false);
      });
  }, [accessToken]);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      { !accessToken && (
        <div className="absolute w-dvw h-dvh flex flex-col justify-center items-center gap-4">
          <span className="text-4xl">CTE Radio 📻</span>
          <span className="italic">Use your school provided Google account to login.</span>
          <button className="btn btn-primary" onClick={() => loginWithGoogle()}>Login with Google</button>
        </div>
      )}

      { !!accessToken && (
        <div className="absolute min-w-dvw min-h-dvh flex flex-row justify-start items-start gap-4 p-8">
          <PlaylistIds
            accessToken={accessToken}
            selectedId ={selectedId}
            playlistIds={playlistIds}
            setSelectedId={setSelectedId}
            setPlaylistIds={setPlaylistIds}

            fetchingPlaylistIds={fetchingPlaylistIds}
            setFetchingPlaylistIds={setFetchingPlaylistIds}
          />
          <Playlist
            accessToken={accessToken}
            playlistId={selectedId}
            playlists={playlists}
            setPlaylists={setPlaylists}

            fetchingPlaylist={fetchingPlaylist}
            setFetchingPlaylist={setFetchingPlaylist}
          />
        </div>
      )}
    </GoogleOAuthProvider>
  )
}

function PlaylistIds({
  accessToken   ,
  selectedId    ,
  playlistIds   ,
  setSelectedId ,
  setPlaylistIds,

  fetchingPlaylistIds,
  setFetchingPlaylistIds,  
}: {
  accessToken   : string,
  selectedId    : string,
  playlistIds   : Array<string>,
  setSelectedId : React.Dispatch<React.SetStateAction<string>>,
  setPlaylistIds: React.Dispatch<React.SetStateAction<Array<string>>>,
  fetchingPlaylistIds: boolean,
  setFetchingPlaylistIds: React.Dispatch<React.SetStateAction<boolean>>,
}) {

  const modal = useRef<HTMLDialogElement>(null);

  const [newPlaylistId, setNewPlaylistId] = useState("");

  function tryNewPlaylist() {
    setFetchingPlaylistIds(true);
    newPlaylist(accessToken, newPlaylistId)
      .then(() => getPlaylistIds(accessToken))
      .then(setPlaylistIds)
      .then(() => {
        setSelectedId(newPlaylistId)
      })
      .catch(alert)
      .finally(() => {
        setFetchingPlaylistIds(false);
      })
  }

  return (
    <>
      <table className="min-w-2xs">
        <thead>
          <tr>
            <td>
              <span className="bg-base-300 p-2 text-lg font-bold flex flex-row gap-2 items-center justify-center flex-nowrap"><Radio/> Playlists</span>
            </td>
          </tr>
        </thead>
        <tbody>
          { playlistIds.map(playlistId => (
            <PlaylistId
              key={playlistId}
              playlistId={playlistId}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            />
          ))}

          { fetchingPlaylistIds && (          
            <tr>
              <td>
                <div className="flex justify-center items-center p-2">
                  <div className="loading loading-dots"/>
                </div>
              </td>
            </tr>
          )}

          <tr>
            <td>
              <button className="btn w-full" onClick={
                () => modal.current?.showModal()
              }><Plus size={16}/> New Playlist</button>
            </td>
          </tr>
        
        </tbody>
      </table>

      <dialog className="modal" ref={modal}>
        <form method="dialog" className="modal-box">
          <span className="font-bold text-lg">New Playlist</span>
          <div className="mt-4">
              <input className="input input-bordered w-full" type="text" placeholder="Name"
                value={newPlaylistId} onChange={e => setNewPlaylistId(e.target.value)}
              />
          </div>
          <div className="modal-action">
              <button className="btn btn-primary" onClick={() => tryNewPlaylist()}>Create</button>
              <button className="btn">Cancel</button>
          </div>
        </form>
        <form method="dialog" className="modal-backdrop">
          <button>Close</button>
        </form>
      </dialog>
    </>
  )
}

function PlaylistId({
  playlistId   ,
  selectedId   ,
  setSelectedId,
}: {
  playlistId   : string,
  selectedId   : string,
  setSelectedId: React.Dispatch<React.SetStateAction<string>>,
}) {
  return (
    <tr className={clsx(
      "cursor-pointer hover:bg-primary/50 hover:text-primary-content",
      playlistId === selectedId && "bg-primary text-primary-content"
    )} onClick={() => setSelectedId(playlistId)}>
      <td className="p-2 text-lg font-semibold">
        <span>{playlistId}</span>
      </td>
    </tr>
  )
}

function Playlist({
  accessToken,
  playlistId,
  playlists,
  setPlaylists,
  fetchingPlaylist,
  setFetchingPlaylist,
}: {
  accessToken: string,
  playlistId: string,
  playlists: Playlists,
  setPlaylists: React.Dispatch<React.SetStateAction<Playlists>>,
  fetchingPlaylist: number,
  setFetchingPlaylist: React.Dispatch<React.SetStateAction<number>>,
}) {
  const modal = useRef<HTMLDialogElement>(null);

  const [searchString , setSearchString ] = useState("");
  const [searchResults, setSearchResults] = useState<Array<Song>>([]);
  const [fetchingSearchResults, setFetchingSearchResults] = useState(0);

  const [title , setTitle ] = useState("");
  const [artist, setArtist] = useState("");

  const deSearchSongs = useMemo(() => debounce((term: string) => {
    setFetchingSearchResults(count => count + 1);
    searchSongs(term)
      .then(setSearchResults)
      .finally(() => {
        setFetchingSearchResults(count => count - 1);
      })
  }, 500), [ ]);

  useEffect(() => {
    if (!searchString) {
      setSearchResults([]);
      return;
    }
    deSearchSongs(searchString);
    return () => {
      deSearchSongs.cancel();
    }
  }, [searchString, deSearchSongs])

  useEffect(() => {
    if (!playlistId) return;
    setFetchingPlaylist(count => count + 1);
    getPlaylist(accessToken, playlistId)
      .then(playlist => {
        setPlaylists(playlists => {
          return {...playlists, [playlistId]: playlist}
        })
      })
      .catch(alert)
      .finally(() => {
        setFetchingPlaylist(count => count - 1);
      })
  }, [playlistId])

  function tryAddSongRequest() {
    if (!playlistId) return;

    if (!title.trim())
      alert("Song request must include a title");

    setFetchingPlaylist(count => count + 1);
    addSongRequest(accessToken, playlistId, artist, title)
      .then(() => getPlaylist(accessToken, playlistId))
      .then(playlist => setPlaylists(playlists => ({...playlists, [playlistId]: playlist})))
      .catch(alert)
      .finally(() => {
        setFetchingPlaylist(count => count - 1);
      })
  }

  function tryRefresh() {
    if (!playlistId) return;
    setFetchingPlaylist(count => count + 1);
    getPlaylist(accessToken, playlistId)
      .then(playlist => setPlaylists(playlists => ({...playlists, [playlistId]: playlist})))
      .catch(alert)
      .finally(() => {
        setFetchingPlaylist(count => count - 1);
      })
  }

  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <td className="min-w-2xl bg-base-300" colSpan={5}>
              <span className="p-2 text-lg font-bold flex flex-row items-center flex-nowrap gap-2">
                <ListMusic/> {playlistId.toUpperCase() || <div className="loading loading-dots p-2"/>}
              </span>
            </td>
          </tr>
          { !!playlists[playlistId]?.length && (
            <tr>
              <td>
                <span className="flex justify-center font-lg font-bold">Submitted When</span>
              </td>
              <td>
                <span className="flex justify-center font-lg font-bold">Submitted By</span>
              </td>
              <td>
                <span className="flex justify-center font-lg font-bold">Title </span>
              </td>
              <td>
                <span className="flex justify-center font-lg font-bold">Artist</span>
              </td>
              <td>
                <span className="flex justify-center font-lg font-bold">Status</span>
              </td>
            </tr>
          )}
        </thead>
        <tbody>
          { playlists[playlistId] && playlists[playlistId].map(entry => (
            <PlaylistEntry
              key={entry.submittedOn}
              {...entry}
            />
          ))}

          { !fetchingPlaylist && (!playlists[playlistId] || playlists[playlistId].length ===0) && (
            <tr>
              <td colSpan={5}>
                <div className="flex justify-center items-center">
                  <span className="italic text-base-content/75">There are no songs in this playlist yet, try clicking "Request Song" to add one.</span>
                </div>
              </td>
            </tr>
          )}

          { !!fetchingPlaylist && (
            <tr>
              <td colSpan={5}>
                <div className="flex justify-center items-center">
                  <div className="loading loading-dots"/>
                </div>
              </td>
            </tr>
          )}

          <tr>
            <td colSpan={5}>
              <div className="flex justify-center items-center gap-2">
                <button className="btn btn-wide"
                  onClick={() => modal.current?.showModal()}
                ><Plus size={16}/> Request Song</button>
                <button className="btn btn-wide"
                  onClick={() => tryRefresh()}
                ><RotateCw size={16}/> Refresh</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <dialog className="modal" ref={modal}>
        <form method="dialog" className="modal-box">
          <span className="font-bold text-lg">Request Song</span>
          <div className="mt-4">
            <span className="text-base-content/75 italic m-1">Enter the song title and artist</span>

            <div className="flex flex-row gap-2">
              <input className="input input-bordered w-full" type="text" placeholder="Title"  value={title } onChange={e => setTitle (e.target.value)}/>
              <input className="input input-bordered w-full" type="text" placeholder="Artist" value={artist} onChange={e => setArtist(e.target.value)}/>
            </div>

            <span className="text-base-content/75 italic m-1">Or, use itunes to search for a song</span>
              
            <div className="w-full flex flex-row gap-2">
              <input className="input input-bordered grow" type="text" placeholder="Search"
                value={searchString} onChange={e => setSearchString(e.target.value)}
              />
            </div>

            { (!!fetchingSearchResults || !!searchResults.length) && (
              <div className="flex flex-col gap-1">
                <span className="text-base-content/75 italic m-1">Click on a song to select it</span>
                <div className="w-full flex flex-col gap-1 h-48 overflow-y-scroll p-2 rounded-lg bg-base-200">
                  { !!fetchingSearchResults && <div className="flex justify-center items-center p-2">
                    <div className="loading loading-dots"/>
                  </div>}
                  { searchResults.map(song => (
                    <div key={`${song.title}:${song.artist}`} className="flex justify-start gap-2 items-center cursor-pointer hover:bg-base-300 p-2 rounded-lg" onClick={() => {
                      setTitle (song.title );
                      setArtist(song.artist);
                    }}><Plus size={16}/> {song.title} / {song.artist}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-action">
            <button className="btn btn-primary" onClick={tryAddSongRequest}>Request Song</button>
            <button className="btn">Cancel</button>
          </div>
        </form>
        <form method="dialog" className="modal-backdrop">
          <button>Close</button>
        </form>
      </dialog>
    </>
  )
}

export function timeAgo(since: string, now = new Date()): string {
  const when = new Date(since || 0);
  const ms   = now.getTime() - when.getTime();

  if (ms < 0) return "in the future";

  const seconds = Math.floor(ms      / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours   / 24);
  const weeks   = Math.floor(days    / 7);

  if (seconds < 10) return "just now";
  if (seconds < 60) return "a few seconds ago";

  if (minutes === 1) return "a minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;

  if (hours === 1) return "an hour ago";
  if (hours < 24) return `${hours} hours ago`;

  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;

  if (weeks === 1) return "last week";
  return `${weeks} weeks ago`;
}

function PlaylistEntry({
  title,
  artist,
  status,
  submittedOn,
  submittedBy,
  notes,
}: PlaylistEntry) {

  function isPending() {
    return status.trim().toLowerCase() === "pending";
  }

  function isApproved() {
    return status.trim().toLowerCase() === "approved";
  }

  function isRejected() {
    return status.trim().toLowerCase() === "rejected";
  }

  return <tr className="hover:bg-base-300">
      <td>
        <div className="flex justify-center">
          <span className="italic">{timeAgo(submittedOn)}</span>
        </div>
      </td>
      <td>
        <div className="flex justify-center">
          <span className="badge badge-primary badge-outline">{submittedBy.replace("@jamesirwin.org", "")}</span>
        </div>
      </td>
      <td>
        <div className="flex justify-center">
          <span>{title }</span>          
        </div>
      </td>
      <td>
        <div className="flex justify-center">
          <span>{artist}</span>
        </div>
      </td>
      <td>
        <div className="flex justify-center">
          <div className={clsx(
            "tooltip cursor-help w-40",
            isPending () && "badge badge-warning",
            isApproved() && "badge badge-success",
            isRejected() && "badge badge-error",
          )}
          >
            <div className="tooltip-content w-3xs flex flex-col gap-1">
              <span className="font-bold">Notes</span>
              {  !notes && <span className="italic text-wrap">There are no notes to display at this time.</span> }
              { !!notes && <span>{notes}</span> }
            </div>
            <Info size={16}/> {status}
          </div>
        </div>
      </td>
    </tr>
}