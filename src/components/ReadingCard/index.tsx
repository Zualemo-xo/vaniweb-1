import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import ResponsiveCardContainer from "../ResponsiveCardContainer";
import ReactTimeout, { ReactTimeoutProps } from "react-timeout";
import {
  CircularProgress,
  createStyles,
  Theme,
  WithStyles,
  withStyles,
} from "@material-ui/core";
import { IconButton } from "@material-ui/core";
import red from "@material-ui/core/colors/red";
import KeyboardArrowRightIcon from "@material-ui/icons/KeyboardArrowRight";
import { Component } from "react";
import { words, ages } from "../../assets/schonell_sentences.json";
import axios from "../Axios";

const MicRecorder = require("mic-recorder-to-mp3");

const Zoom = require("react-reveal/Zoom");

interface ResponseData {
  value: boolean;
}

const styles = (theme: Theme) =>
  createStyles({
    cardActions: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      "&:hover": {
        opacity: 1,
      },
    },
    controls: {
      display: "flex",
      color: theme.palette.success.main,
      justifyContent: "center",
      alignItems: "center",
      margin: theme.spacing(2),
    },
    content: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      margin: theme.spacing(2),
    },
    recordButton: {
      background: red[500],
      color: "#fff",
    },
    stopButton: {
      background: "#fff",
      border: "2px solid " + red[500],
      color: red[500],
      animation: `$pulse 0.5s ${theme.transitions.easing.easeOut} infinite alternate`,
    },
    "@keyframes pulse": {
      "0%": {
        transform: "scale(1)",
        opacity: 1,
      },
      "100%": {
        transform: "scale(1.1)",
        opacity: 0.5,
        filter: "blur(0.5px)",
      },
    },
  });

const TextCard = ({ text }: { text: string }) => {
  return (
    <Zoom bottom key={text}>
      <Typography variant="h3">{text}</Typography>
    </Zoom>
  );
};
function initialiseArray(): null[][] {
  let arr = new Array(18);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = new Array(5).fill(null);
  }
  return arr;
}

type UIStates = "inactive" | "reading" | "sending" | "done";

interface State {
  matrix: (boolean | null)[][];
  uiState: UIStates;
  currentWordPosition: number[];
  readingAge: null | number[];
}

type PropType = WithStyles<typeof styles> & ReactTimeoutProps;

class ReadingCard extends Component<PropType, State> {
  state: State = {
    matrix: initialiseArray(),
    uiState: "inactive" as UIStates,
    currentWordPosition: [0, 0],
    readingAge: null,
  };

  timeout?: ReactTimeout.Timer;

  recorder = new MicRecorder();

  async componentDidMount() {
    try {
      await this.recorder.start();
      this.startTimeout();
      this.setState({ uiState: "reading" });
    } catch (e) {
      alert("Microphone Permission Denied");
    }
  }

  startTimeout = () => {
    if (!this.timeout) {
      this.timeout = setTimeout(() => this.handleNext(true), 4000);
    }
  };

  stopTimeout = () => {
    if (this.props.clearTimeout && this.timeout) {
      this.props.clearTimeout(this.timeout);
    }
    this.timeout = undefined;
  };

  canEnd = () => {
    const { matrix } = this.state;

    const flat = matrix.flat();
    const limit = flat.indexOf(null);

    let consecutiveCount = 0;
    let correctWords = 0;
    for (let i = 0; i <= limit; i++) {
      if (flat[i] === true) {
        correctWords++;
        consecutiveCount = 0;
      } else ++consecutiveCount;

      if (consecutiveCount === 5) break;
    }

    if (consecutiveCount === 5) {
      this.setState({
        uiState: "done",
        readingAge: ages[correctWords],
      });
      return true;
    } else return false;
  };

  handleNext = (skip: boolean = false) => {
    this.stopTimeout();
    this.recorder
      .stop()
      .getMp3()
      .then((audioData: any[]) => {
        const [buffer, blob] = audioData;
        if (this.canEnd()) return true;
        this.setState({ uiState: "sending" });
        const { currentWordPosition } = this.state;
        const word = words[currentWordPosition[0]][currentWordPosition[1]];
        const audioFile = new File(buffer, word + ".mp3", {
          type: blob.type,
          lastModified: Date.now(),
        });
        console.log(audioFile);
        if (skip) {
          this.setState((prevState) => {
            let newMatrix = [...prevState.matrix];
            newMatrix[prevState.currentWordPosition[0]][
              prevState.currentWordPosition[1]
            ] = false;

            let newPositions;
            if (currentWordPosition[1] === 4) {
              newPositions = [prevState.currentWordPosition[0] + 1, 0];
            } else {
              newPositions = [
                prevState.currentWordPosition[0],
                prevState.currentWordPosition[1] + 1,
              ];
            }
            this.recorder.start();
            this.startTimeout();
            return {
              ...prevState,
              matrix: newMatrix,
              currentWordPosition: newPositions,
              uiState: "reading",
            };
          });
        } else {
          const data = new FormData();
          data.append("word", word);
          data.append("audioFile", audioFile);
          axios
            .post<ResponseData>(
              process.env.REACT_APP_API_AUDIO_ENDPOINT ||
                "/default/test-func/testapi/upload",
              data,
              {
                headers: {
                  "content-type": "multipart/form-data",
                },
              }
            )
            .then(
              (response) => {
                this.setState((prevState) => {
                  let newMatrix = [...prevState.matrix];
                  newMatrix[prevState.currentWordPosition[0]][
                    prevState.currentWordPosition[1]
                  ] = response.data.value;

                  let newPositions;
                  if (currentWordPosition[1] === 4) {
                    newPositions = [prevState.currentWordPosition[0] + 1, 0];
                  } else {
                    newPositions = [
                      prevState.currentWordPosition[0],
                      prevState.currentWordPosition[1] + 1,
                    ];
                  }
                  this.recorder.start();
                  this.startTimeout();
                  return {
                    ...prevState,
                    matrix: newMatrix,
                    currentWordPosition: newPositions,
                    uiState: "reading",
                  };
                });
              },
              (error) => {
                console.error(error);
                alert(error.message);
              }
            );
        }
      });
  };

  render() {
    const { currentWordPosition, uiState, readingAge } = this.state;
    const { classes } = this.props;
    const word = words[currentWordPosition[0]][currentWordPosition[1]];
    const initialUI = (
      <Typography
        gutterBottom
        color="textSecondary"
        style={{ textAlign: "center" }}
        component="div"
      >
        Please start recoding
      </Typography>
    );

    const readingAgeResult = () => {
      const { readingAge } = this.state;
      if (readingAge === null || !Array.isArray(readingAge)) {
        return `There's some error in calculating your reading age`;
      } else {
        return readingAge[0] + " years and " + readingAge[1] + " months";
      }
    };

    const resultUI = (
      <>
        <Typography
          gutterBottom
          color="textSecondary"
          style={{ textAlign: "center" }}
          component="div"
        >
          {Array.isArray(readingAge) && "Congratulations"}
        </Typography>
        {Array.isArray(readingAge) && (
          <Typography
            gutterBottom
            color="textSecondary"
            variant="h5"
            style={{ textAlign: "center" }}
            component="div"
          >
            Your reading age is
          </Typography>
        )}
        <Typography
          gutterBottom
          color="textSecondary"
          variant="h3"
          style={{ textAlign: "center" }}
          component="div"
        >
          {readingAgeResult()}
        </Typography>
      </>
    );
    const loadingUI = (
      <div style={{ textAlign: "center" }}>
        <CircularProgress />
      </div>
    );

    const readingUI = (
      <>
        <Typography color="textSecondary" variant="h6" component="h2">
          Read the text below
        </Typography>
        <TextCard text={word} />
      </>
    );

    const getUI = () => {
      switch (this.state.uiState) {
        case "inactive":
          return initialUI;
        case "reading":
          return readingUI;
        case "done":
          return resultUI;
        case "sending":
        default:
          return loadingUI;
      }
    };

    return (
      <ResponsiveCardContainer>
        <CardContent className={classes.content}>{getUI()}</CardContent>
        {uiState !== "done" && (
          <CardActions className={classes.controls}>
            <>
              {/* <IconButton color="secondary" onClick={() => void 0}>
              <KeyboardArrowLeftIcon />
            </IconButton> */}
              <IconButton
                disabled={uiState !== "reading"}
                color="inherit"
                onClick={() => this.handleNext()}
              >
                <KeyboardArrowRightIcon />
              </IconButton>
            </>
          </CardActions>
        )}
      </ResponsiveCardContainer>
    );
  }
}

export default withStyles(styles)(ReactTimeout(ReadingCard));
/*
export function ReadinggCard() {
  const classes = useStyles();

  const { endTest, recordingState, error, next, startTest, word, loading } =
    useSchonell((score) => void 0);

  const Controls = () => {
    switch (recordingState) {
      case "inactive":
        return (
          <IconButton
            size="medium"
            className={classes.recordButton}
            color="default"
            onClick={startTest}
          >
            <MicIcon />
          </IconButton>
        );
      case "recording":
        return (
          <IconButton
            size="medium"
            className={classes.stopButton}
            color="default"
            onClick={endTest}
          >
            <StopIcon />
          </IconButton>
        );
      case "stopped":
        return (
          <IconButton
            size="medium"
            className={classes.stopButton}
            color="default"
          >
            <CloudUploadTwoToneIcon />
          </IconButton>
        );
    }
  };
  if (error.status) {
    return (
      <div style={{ textAlign: "center" }}>
        <AlertError /> <br />
        {"Oops! something went wrong please refresh"}
        <br />
        {error.message ?? ""}
      </div>
    );
  }
  //  !loading && setTimeout(next, 15 * 1000);
  return (
    <ResponsiveCardContainer>
      <CardContent>
        {loading ? (
          <div style={{ textAlign: "center" }}>
            <CircularProgress />
          </div>
        ) : recordingState === "inactive" ? (
          <Typography
            gutterBottom
            color="textSecondary"
            style={{ textAlign: "center" }}
            component="div"
          >
            Please start recoding
          </Typography>
        ) : (
          <>
            <Typography
              gutterBottom
              color="textSecondary"
              variant="h6"
              component="h2"
            >
              Read the text below
            </Typography>
            <TextCard text={word} />
          </>
        )}
      </CardContent>
      <CardActions className={classes.controls}>
        {!loading && (
          <>
            <IconButton
              disabled={loading || recordingState === "inactive"}
              color="secondary"
              onClick={() => void 0}
            >
              <KeyboardArrowLeftIcon />
            </IconButton>
            {Controls()}
            <IconButton
              disabled={loading || recordingState === "inactive"}
              color="primary"
              onClick={next}
            >
              <KeyboardArrowRightIcon />
            </IconButton>
          </>
        )}
      </CardActions>
    </ResponsiveCardContainer>
  );
}
*/
