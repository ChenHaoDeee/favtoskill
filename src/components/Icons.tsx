import CopyIcon from '@icon-park/react/es/icons/Copy';
import FolderIcon from '@icon-park/react/es/icons/Folder';
import TipsIcon from '@icon-park/react/es/icons/Tips';
import HelpIcon from '@icon-park/react/es/icons/Help';
import ShareIcon from '@icon-park/react/es/icons/Share';
import LikeIcon from '@icon-park/react/es/icons/Like';
import CommentsIcon from '@icon-park/react/es/icons/Comments';
import PlayOneIcon from '@icon-park/react/es/icons/PlayOne';
import PauseOneIcon from '@icon-park/react/es/icons/PauseOne';
import EditIcon from '@icon-park/react/es/icons/Edit';
import SettingsIcon from '@icon-park/react/es/icons/SettingTwo';
import type { ComponentType } from 'react';
import type { IIconProps } from '@icon-park/react/es/runtime';
import ArrowLeftIcon from '@icon-park/react/es/icons/ArrowLeft';
import ArrowRightIcon from '@icon-park/react/es/icons/ArrowRight';
import ArrowUpRightIcon from '@icon-park/react/es/icons/ArrowRightUp';
import ArrowUpIcon from '@icon-park/react/es/icons/ArrowUp';
import ChevronRightIcon from '@icon-park/react/es/icons/Right';
import BlocksIcon from '@icon-park/react/es/icons/AllApplication';
import BookmarkIcon from '@icon-park/react/es/icons/Bookmark';
import DownloadIcon from '@icon-park/react/es/icons/Download';
import FilePlus2Icon from '@icon-park/react/es/icons/FileAddition';
import SearchIcon from '@icon-park/react/es/icons/Search';
import SparklesIcon from '@icon-park/react/es/icons/Magic';
import XIcon from '@icon-park/react/es/icons/Close';
import CheckIcon from '@icon-park/react/es/icons/Check';
import HistoryIcon from '@icon-park/react/es/icons/History';
import Maximize2Icon from '@icon-park/react/es/icons/FullScreenTwo';
import Minimize2Icon from '@icon-park/react/es/icons/OffScreenTwo';
import PlusIcon from '@icon-park/react/es/icons/Plus';
import FileTextIcon from '@icon-park/react/es/icons/FileText';
import RobotIcon from '@icon-park/react/es/icons/Robot';
import BriefcaseIcon from '@icon-park/react/es/icons/Briefcase';
import BookOpenIcon from '@icon-park/react/es/icons/BookOpen';
import AirplaneIcon from '@icon-park/react/es/icons/Airplane';
import GameIcon from '@icon-park/react/es/icons/Game';
import VideoIcon from '@icon-park/react/es/icons/Video';
import FoodIcon from '@icon-park/react/es/icons/Hamburger';
import BookIcon from '@icon-park/react/es/icons/Book';
import CpuIcon from '@icon-park/react/es/icons/Cpu';
import HomeIcon from '@icon-park/react/es/icons/Home';
import FitnessIcon from '@icon-park/react/es/icons/Fitness';

// A single adapter keeps IconPark size, colour and stroke consistent across the app.
function icon(Component:ComponentType<IIconProps>){
  return function AppIcon({size=20,theme='outline',fill='currentColor',strokeWidth=3.5,...props}:IIconProps){
    return <Component size={size} theme={theme} fill={fill} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}/>;
  };
}
export const ArrowLeft=icon(ArrowLeftIcon);
export const ArrowRight=icon(ArrowRightIcon);
export const ArrowUpRight=icon(ArrowUpRightIcon);
export const ArrowUp=icon(ArrowUpIcon);
export const ChevronRight=icon(ChevronRightIcon);
export const Blocks=icon(BlocksIcon);
export const Bookmark=icon(BookmarkIcon);
export const Download=icon(DownloadIcon);
export const FilePlus2=icon(FilePlus2Icon);
export const Search=icon(SearchIcon);
export const Sparkles=icon(SparklesIcon);
export const X=icon(XIcon);
export const Check=icon(CheckIcon);
export const History=icon(HistoryIcon);
export const Maximize2=icon(Maximize2Icon);
export const Minimize2=icon(Minimize2Icon);
export const Plus=icon(PlusIcon);
export const FileText=icon(FileTextIcon);
export const Robot=icon(RobotIcon);
export const Briefcase=icon(BriefcaseIcon);
export const BookOpen=icon(BookOpenIcon);
export const Airplane=icon(AirplaneIcon);
export const Game=icon(GameIcon);
export const Video=icon(VideoIcon);
export const Food=icon(FoodIcon);
export const Book=icon(BookIcon);
export const Cpu=icon(CpuIcon);
export const Home=icon(HomeIcon);
export const Fitness=icon(FitnessIcon);

export const Settings=icon(SettingsIcon);
export function AiStar({size=20}:IIconProps){return <img className="ai-sparkle-mark" src="/brand/ai-sparkles.svg" width={size} height={size} alt="" aria-hidden="true"/>}

export const Edit=icon(EditIcon);

export const Share=icon(ShareIcon);
export const Like=icon(LikeIcon);
export const Comments=icon(CommentsIcon);
export const PlayOne=icon(PlayOneIcon);
export const PauseOne=icon(PauseOneIcon);

export const Copy=icon(CopyIcon);
export const Folder=icon(FolderIcon);
export const Tips=icon(TipsIcon);
export const Help=icon(HelpIcon);
