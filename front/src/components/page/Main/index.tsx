import React, {
  MouseEventHandler,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useParams } from "react-router";
import search, { GameSearchResultItem } from "../../../api/search";
import useDiscussion from "../../../hooks/useDiscussionRTC";
import { debounce } from "throttle-debounce";
import { getGameMetaData } from "../../../api/game";

import SearchPanel from "../../ui/SearchPanel";

import styles from "./styles.module.css";
import GameSuggest from "../../model/discussion/GameSuggest";
import Badge from "../../ui/Badge";
import Board from "../../ui/Board";
import GamePanel from "../../model/discussion/GamePanel";
import Draggable from "react-draggable";
import Canvas from "../../ui/Canvas";
import getRecommend, { Recommend } from "../../../api/recommend";
import Accordion from "../../ui/Accordion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeart as faHeartSolid,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";
import classNames from "classnames";
import colorByMembers from "../../../helpers/colorByMembers";

const debouncedSearch = debounce(
  500,
  (
    searchString: string,
    resolve: (result: GameSearchResultItem[]) => void,
    reject: (error: string) => void
  ) => {
    if (searchString.length === 0) {
      return;
    }
    // console.log("検索開始");
    search(searchString)
      .then((result) => {
        // console.log("検索完了");
        resolve(result);
      })
      .catch((error) => {
        console.log(error);
        reject(error);
      });
  }
);

export default function Main() {
  const { discussId } = useParams();

  const discussionBoard = useDiscussion(discussId ?? null);

  const [searchString, setSearchString] = useState("");
  const [searchResult, setSearchResult] = useState<GameSearchResultItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [recommends, setRecommends] = useState<Recommend[] | null>(null);

  const onSearchStringChange = (next: string) => {
    // console.log("onsearchstringchange");
    setSearchString(next);
    setSearchError(null);
    debouncedSearch(
      next,
      (result) => {
        if (result.length <= 100) {
          setSearchResult(result.slice(0, 10));
        } else {
          setSearchResult(result.slice(0, 10));
          //setSearchError(`省略して表示しています(全${result.length}件)`);
        }
      },
      () => {
        setSearchError("検索に失敗しました");
      }
    );
  };

  const onSearchResultClicked = (id: string) => async () => {
    const gameMetaData = await getGameMetaData(id);
    discussionBoard.addGameToArena(gameMetaData);
  };

  const onApprovalButtonClicked = (id: string) => async () => {
    if (!discussionBoard.id || !discussionBoard.discussion?.item[id].approver) {
      return;
    }
    // console.log(discussionBoard.discussion.item[id]);
    if (
      discussionBoard.id in discussionBoard.discussion.item[id].approver &&
      discussionBoard.discussion.item[id].approver[discussionBoard.id]
    ) {
      discussionBoard.disApproveGame(id);
    } else {
      discussionBoard.approveGame(id);
    }
  };

  const onGamePanelControlMouseMoveCaptured: MouseEventHandler<
    HTMLDivElement
  > = (ev) => {
    ev.stopPropagation();
  };

  const onDragged =
    (id: string) =>
    (e: any, { x, y }: { x: number; y: number }) => {
      discussionBoard.moveGame(id, { x, y });
    };

  useEffect(() => {
    getRecommend().then((result) => {
      setRecommends(Object.values(result));
    });
  }, []);

  if (!discussId) {
    return <div>ディスカッションIDが指定されていません</div>;
  }

  if (discussionBoard.error) {
    return <div>接続失敗({discussionBoard.error})</div>;
  }

  if (!discussionBoard.isConnected) {
    return <div>接続中…</div>;
  }

  return (
    <div className={styles.main}>
      <div className={styles.leftPane}>
        {discussionBoard.discussion ? (
          <Board className={styles.board}>
            <Canvas
              width={1280}
              height={720}
              className={styles.canvas}
              baseImage={discussionBoard.discussion.canvas}
              onDrawEnd={(url) => {
                discussionBoard.updateCanvas(url);
              }}
            ></Canvas>
            {Object.values(discussionBoard.discussion.item).map((item) => (
              <Draggable
                key={item.game.id}
                position={{ x: item.x, y: item.y }}
                onStop={onDragged(item.game.id)}
              >
                <div className={styles.panelWrapper}>
                  <div
                    className={styles.pureWrapper}
                    style={{
                      transform: `scale(${
                        1.0 +
                        Object.values(item.approver).filter((b) => b).length *
                          0.1
                      })`,
                    }}
                  >
                    <GamePanel game={item.game} className={styles.gamePanel}>
                      <Badge
                        color={colorByMembers(
                          Object.values(item.approver).filter((b) => b).length
                        )}
                      >
                        {Object.values(item.approver).filter((b) => b).length}
                      </Badge>
                    </GamePanel>
                    <div
                      className={styles.gamePanelControl}
                      onMouseDownCapture={onGamePanelControlMouseMoveCaptured}
                    >
                      <a
                        className={styles.detailsButton}
                        href={item.game.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FontAwesomeIcon icon={faInfoCircle} />
                      </a>
                      {discussionBoard.id ? (
                        <button
                          className={classNames(styles.approvalButton, {
                            [styles.approving]:
                              item.approver[discussionBoard.id],
                          })}
                          onClick={onApprovalButtonClicked(item.game.id)}
                        >
                          {item.approver[discussionBoard.id] ? (
                            <FontAwesomeIcon icon={faHeartSolid} />
                          ) : (
                            <FontAwesomeIcon icon={faHeartRegular} />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Draggable>
            ))}
          </Board>
        ) : (
          `ホワイトボードを読み込んでいます(${discussId})...`
        )}
      </div>
      <div className={styles.rightPane}>
        <SearchPanel value={searchString} onChange={onSearchStringChange}>
          {searchError
            ? searchError
            : searchResult.length > 0
            ? searchResult.map((item, index) => {
                /* TODO: SearchPanelSuggestにする */
                return (
                  <GameSuggest
                    key={index}
                    game={item}
                    onClick={onSearchResultClicked(item.appid)}
                  />
                );
              })
            : null}
        </SearchPanel>
        <Accordion className={styles.recommendation} text="運営からのおすすめ">
          {recommends?.map((item, index) => (
            <GameSuggest
              key={index}
              game={item}
              onClick={onSearchResultClicked(item.appid)}
            />
          ))}
        </Accordion>
      </div>
    </div>
  );
}
